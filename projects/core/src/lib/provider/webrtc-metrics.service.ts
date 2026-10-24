/// <reference path="./peermetrics.d.ts" />
import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {WebRTCStats} from '@peermetrics/webrtc-stats';

export type MetricsDirection = 'send' | 'receive';
export interface MediaMetrics {
  direction: MetricsDirection;
  kind: string;
  id: string;
  label?: string;
  bitrate: number | null;
  loss: number | null;
  jitterMs: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  limitation: string | null;
}
export interface CandidateMetrics { type: string | null; address: string | null; protocol: string | null; }
export interface ConnectionMetrics {
  id: string;
  direction: MetricsDirection;
  state: string;
  iceState: string;
  rttMs: number | null;
  route: string;
  localCandidate?: CandidateMetrics;
  remoteCandidate?: CandidateMetrics;
  tracks: MediaMetrics[];
  error?: string;
}
export interface MetricsSample { timestamp: number; connections: ConnectionMetrics[]; }
export interface MetricsEvent { timestamp: number; message: string; }
export interface MetricsView { samples: MetricsSample[]; events: MetricsEvent[]; }

// PeerMetrics forwards browser-specific RTCStats fields; unavailable values remain null.
type Stat = Record<string, any>;
export type TrackLabelResolver = (stats: Record<string, any>, direction: MetricsDirection) => string | undefined;
interface Registration { pc: RTCPeerConnection; direction: MetricsDirection; labelTrack?: TrackLabelResolver; }
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const nonempty = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const candidateMetrics = (candidate: Stat | undefined): CandidateMetrics => ({type: nonempty(candidate?.['candidateType']),
  address: nonempty(candidate?.['address']) ?? nonempty(candidate?.['ip']), protocol: nonempty(candidate?.['protocol'])});
const millis = (value: unknown): number | null => { const n = finite(value); return n === null ? null : n * 1000; };

export function parseConnectionMetrics(id: string, registration: Registration, data: Stat): ConnectionMetrics {
  const tracks: MediaMetrics[] = [];
  for (const kind of ['audio', 'video']) {
    for (const [key, direction] of [['outbound', 'send'], ['inbound', 'receive']] as const) {
      for (const track of data[kind]?.[key] ?? []) {
        const feedback = (data['remote']?.[kind]?.['inbound'] ?? []).find((remote: Stat) =>
          remote['localId'] === track['id'] || (remote['ssrc'] !== undefined && remote['ssrc'] === track['ssrc']));
        tracks.push({
          id: track['id'], kind, direction, label: registration.labelTrack?.(track, direction),
          bitrate: finite(track['bitrate']),
          loss: finite(direction === 'receive' ? track['packetLossRate'] : feedback?.['fractionLost']),
          jitterMs: millis(direction === 'receive' ? track['jitter'] : feedback?.['jitter']),
          fps: finite(track['framesPerSecond']), width: finite(track['frameWidth']), height: finite(track['frameHeight']),
          codec: track['mimeType'] ?? null, limitation: track['qualityLimitationReason'] ?? null,
        });
      }
    }
  }
  const connection = data['connection'] ?? {};
  const local = connection['local'] ?? connection['localCandidate'];
  const remote = connection['remote'] ?? connection['remoteCandidate'];
  return {id, direction: registration.direction, state: registration.pc.connectionState,
    iceState: registration.pc.iceConnectionState,
    rttMs: millis(connection['currentRoundTripTime']),
    localCandidate: candidateMetrics(local), remoteCandidate: candidateMetrics(remote),
    route: [local?.['candidateType'], remote?.['candidateType'], local?.['protocol']].filter(Boolean).join(' / ') || '—', tracks};
}

@Injectable({providedIn: 'root'})
export class WebrtcMetricsService implements OnDestroy {
  private readonly registrations = new Map<string, Registration>();
  private readonly latest = new Map<string, {value: ConnectionMetrics; receivedAt: number}>();
  private collector?: WebRTCStats;
  private timer?: ReturnType<typeof setInterval>;
  private viewers = 0;
  private readonly visibilityChecks = new Set<() => boolean>();
  private sequence = 0;
  private generation = 0;
  private readonly state = new BehaviorSubject<MetricsView>({samples: [], events: []});
  readonly view$ = this.state.asObservable();

  constructor(private zone: NgZone) {}

  register(pc: RTCPeerConnection, direction: MetricsDirection, labelTrack?: TrackLabelResolver): () => void {
    const id = `connection-${++this.sequence}`;
    this.registrations.set(id, {pc, direction, labelTrack});
    if (this.viewers) this.attach(id, {pc, direction, labelTrack});
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      try { this.collector?.removeConnection({connectionId: id}); }
      catch { /* PeerMetrics may already have removed a closed connection. */ }
      this.registrations.delete(id);
      this.latest.delete(id);
      if (this.viewers) this.event(`${direction === 'send' ? 'Outgoing' : 'Incoming'} connection closed`);
      if (!this.registrations.size) { this.stop(); this.state.next({samples: [], events: []}); }
    };
  }

  /** Collection exists only while a dashboard is subscribed through this lease. */
  observe(isVisible: () => boolean = () => typeof document === 'undefined' || !document.hidden): () => void {
    const visible = () => isVisible();
    this.visibilityChecks.add(visible);
    this.viewers++;
    if (this.viewers === 1) this.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.visibilityChecks.delete(visible);
      if (--this.viewers === 0) { this.stop(); this.state.next({samples: [], events: []}); }
    };
  }

  private start(): void {
    if (this.collector || !this.registrations.size) return;
    const generation = ++this.generation;
    this.zone.runOutsideAngular(() => {
      this.collector = this.createCollector();
      this.collector.on('stats', (event: Stat) => {
        if (generation !== this.generation) return;
        const id = event['connectionId'];
        const registration = this.registrations.get(id);
        if (!registration) return;
        this.latest.set(id, {value: parseConnectionMetrics(id, registration, event['data']), receivedAt: Date.now()});
        this.collector?.clearTimeline();
      });
      for (const [id, registration] of this.registrations) this.attach(id, registration);
      this.timer = setInterval(() => {
        if (![...this.visibilityChecks].some(visible => visible())) { this.collector?.clearTimeline(); return; }
        const connections = [...this.registrations].map(([id, registration]) => {
          const latest = this.latest.get(id);
          const fresh = latest && Date.now() - latest.receivedAt < 5000;
          return {...(fresh ? latest.value : {id, direction: registration.direction, rttMs: null, route: '—', tracks: []}),
            state: registration.pc.connectionState, iceState: registration.pc.iceConnectionState,
            error: fresh ? undefined : 'Waiting for current measurements'};
        });
        const current = this.state.value;
        const previous = current.samples.at(-1);
        const events = [...current.events];
        for (const connection of connections) {
          const old = previous?.connections.find(item => item.id === connection.id);
          if (!old || old.state !== connection.state || old.iceState !== connection.iceState) {
            events.push({timestamp: Date.now(), message: `${connection.direction === 'send' ? 'Outgoing' : 'Incoming'}: ${connection.state} / ICE ${connection.iceState}`});
          }
        }
        this.zone.run(() => this.state.next({samples: [...current.samples.filter(s => s.timestamp > Date.now() - 600000),
          {timestamp: Date.now(), connections}].slice(-600), events: events.slice(-50)}));
        this.collector?.clearTimeline();
      }, 1000);
    });
  }

  private createCollector(): WebRTCStats {
    return new WebRTCStats({getStatsInterval: 1000, remote: true, rawStats: false,
      wrapGetUserMedia: false, wrapGetDisplayMedia: false});
  }

  private attach(id: string, registration: Registration): void {
    if (!this.collector) { this.start(); return; }
    const collector = this.collector;
    void collector.addConnection({pc: registration.pc, peerId: id, connectionId: id}).catch(() => {
      if (this.collector === collector && this.registrations.has(id)) this.event('Connection metrics unavailable');
    });
  }

  private event(message: string): void {
    this.zone.run(() => this.state.next({...this.state.value,
      events: [...this.state.value.events, {timestamp: Date.now(), message}].slice(-50)}));
  }

  private stop(): void {
    ++this.generation;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.collector?.destroy();
    this.collector = undefined;
    this.latest.clear();
  }

  ngOnDestroy(): void { this.stop(); this.registrations.clear(); this.visibilityChecks.clear(); this.state.complete(); }
}
