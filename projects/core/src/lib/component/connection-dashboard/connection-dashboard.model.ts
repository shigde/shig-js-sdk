import {ConnectionMetrics, MediaMetrics, MetricsDirection, MetricsSample, MetricsView} from '../../provider/webrtc-metrics.service';

export interface Assessment { label: string; description: string; tone: 'good' | 'warning' | 'unknown'; }
export interface MetricRow { label: string; help: string; send: string; receive: string; }
const directions: MetricsDirection[] = ['send', 'receive'];
export const connectionFor = (sample: MetricsSample | undefined, direction: MetricsDirection) => sample?.connections.find(c => c.direction === direction);
const tracksFor = (sample: MetricsSample | undefined, direction: MetricsDirection, kind?: string): MediaMetrics[] => {
  const c = connectionFor(sample, direction);
  return c && !c.error ? c.tracks.filter(t => t.direction === direction && (!kind || t.kind === kind)) : [];
};
export function rate(sample: MetricsSample | undefined, direction: MetricsDirection, kind: string): number | null {
  const tracks = tracksFor(sample, direction, kind);
  if (!tracks.length || tracks.some(t => t.bitrate === null)) return null;
  return tracks.reduce((sum, t) => sum + t.bitrate!, 0) / (kind === 'audio' ? 1000 : 1000000);
}
const number = (value: number | null, unit: string, digits = 1): string => value === null ? '—' : `${value.toFixed(digits)} ${unit}`;
function worst(tracks: MediaMetrics[], key: 'loss' | 'jitterMs'): number | null {
  return !tracks.length || tracks.some(t => t[key] === null) ? null : Math.max(...tracks.map(t => t[key]!));
}
export function mediaRows(sample: MetricsSample | undefined, kind: string): MetricRow[] {
  const both = (read: (tracks: MediaMetrics[], direction: MetricsDirection) => string): Pick<MetricRow, 'send' | 'receive'> => ({
    send: read(tracksFor(sample, 'send', kind), 'send'), receive: read(tracksFor(sample, 'receive', kind), 'receive'),
  });
  const rows: MetricRow[] = [
    {label: 'Data rate', help: 'Measured media throughput, not your connection’s maximum capacity. Lower rates alone do not indicate a problem.',
      ...both((_t, d) => number(rate(sample, d, kind), kind === 'audio' ? 'kbit/s' : 'Mbit/s', kind === 'audio' ? 1 : 2))},
    {label: 'Packet loss', help: 'Media packets that did not arrive. Highest track value; outgoing values require receiver feedback. Incoming and outgoing measurement windows can differ.',
      ...both(t => {const loss = worst(t, 'loss'); return number(loss === null ? null : loss * 100, '%', 2);})},
    {label: 'Jitter', help: 'Variation in packet arrival times. Highest track value; outgoing values require receiver feedback.', ...both(t => number(worst(t, 'jitterMs'), 'ms'))},
  ];
  if (kind === 'video') {
    rows.push({label: 'Resolution', help: 'Measured video dimensions. Multiple tracks are listed separately.',
      ...both(t => t.map(v => v.width !== null && v.height !== null ? `${v.width} × ${v.height}` : '—').join(' · ') || '—')},
      {label: 'Frame rate', help: 'Measured frames per second for each video track.', ...both(t => t.map(v => number(v.fps, 'fps', 0)).join(' · ') || '—')});
  }
  return rows;
}
export function trackGroups(sample: MetricsSample | undefined, direction: MetricsDirection, kind: string) {
  const tracks = tracksFor(sample, direction, kind);
  return tracks.map((track, index) => {
    const base = track.label || `${kind === 'audio' ? 'Audio' : 'Video'} track ${index + 1}`;
    const duplicates = tracks.filter(t => t.label === track.label).length;
    const label = track.label && duplicates > 1 ? `${base} (${tracks.filter(t => t.label === track.label).indexOf(track) + 1})` : base;
    const c = connectionFor(sample, direction)!;
    const single = {timestamp: sample!.timestamp, connections: [{...c, tracks: [track]}]};
    const rows = mediaRows(single, kind).map(row => ({label: row.label, help: row.help, value: row[direction]}));
    rows.push({label: 'Codec', help: 'Codec negotiated for this media track.', value: track.codec ?? '—'});
    if (kind === 'video') rows.push({label: 'Encoder limitation', help: 'Reported encoder limitation for this video track.', value: track.limitation ?? '—'});
    return {id: track.id, label, rows};
  });
}
export function connectionDetails(sample: MetricsSample | undefined, direction: MetricsDirection) {
  const c = connectionFor(sample, direction);
  const [local, remote, protocol] = (c?.route ?? '').split(' / ');
  const candidate = (type: string | undefined): string => ({host: 'Host', srflx: 'NAT public address', prflx: 'Peer-reflexive address', relay: 'TURN relay'}[type ?? ''] ?? type) || '—';
  const rows: {label: string; value: string; address?: boolean}[] = [
    {label: 'State', value: c?.state ?? '—'}, {label: 'ICE state', value: c?.iceState ?? '—'},
    {label: 'Transport protocol', value: (c?.localCandidate?.protocol ?? c?.remoteCandidate?.protocol ?? protocol)?.toUpperCase() || '—'},
    {label: 'Local ICE candidate', value: candidate(c?.localCandidate?.type ?? local)},
    {label: 'Local IP / hostname', value: c?.localCandidate?.address ?? 'Not available', address: true},
    {label: 'Remote ICE candidate', value: candidate(c?.remoteCandidate?.type ?? remote)},
    {label: 'Remote IP / hostname', value: c?.remoteCandidate?.address ?? 'Not available', address: true},
  ];
  return {direction, rows};
}
function transport(sample: MetricsSample | undefined): Assessment {
  const connections = sample?.connections ?? [];
  if (connections.some(c => ['failed', 'disconnected', 'closed'].includes(c.state) || ['failed', 'disconnected', 'closed'].includes(c.iceState))) {
    return {label: 'Connection interrupted', description: 'At least one media connection is disconnected or has failed.', tone: 'warning'};
  }
  if (!directions.every(d => connections.some(c => c.direction === d && c.state === 'connected' && ['connected', 'completed'].includes(c.iceState)))) {
    return {label: 'Connecting', description: 'Waiting for both outgoing and incoming WebRTC connections.', tone: 'unknown'};
  }
  return {label: 'Connection stable', description: 'Both WebRTC connections are established. Media quality is assessed separately.', tone: 'good'};
}
function qualityIssue(c: ConnectionMetrics): string | undefined {
  if (c.rttMs !== null && c.rttMs >= 250) return 'Elevated roundtrip time to the SFU';
  const tracks = c.tracks.filter(t => t.direction === c.direction);
  if (tracks.some(t => t.loss !== null && t.loss >= 0.02)) return 'Elevated packet loss';
  if (tracks.some(t => t.jitterMs !== null && t.jitterMs >= 30)) return 'Elevated packet arrival variation';
  if (tracks.some(t => ['cpu', 'bandwidth'].includes(t.limitation ?? ''))) return 'Video encoder limited by CPU or bandwidth';
  return undefined;
}
export function assessQuality(samples: MetricsSample[]): Assessment {
  const unknown = (description: string): Assessment => ({label: 'Not yet assessable', description, tone: 'unknown'});
  const latest = samples.at(-1);
  if (!latest || Date.now() - latest.timestamp > 5000) return unknown('Waiting for current measurements.');
  const recent = samples.slice(-3);
  if (recent.length < 3 || recent.some((s, i) => i > 0 && s.timestamp - recent[i - 1].timestamp > 3000)) {
    return unknown('Collecting a few consecutive measurements before assessing quality.');
  }
  const connections = directions.map(d => connectionFor(latest, d));
  if (connections.some(c => !c || c.error || c.state !== 'connected')) return unknown('Current measurements for both directions are required.');
  for (const direction of directions) {
    const c = connectionFor(latest, direction)!;
    const evidence = recent.map(s => connectionFor(s, direction));
    if (evidence.some(old => !old || old.error || old.id !== c.id)) return unknown('Waiting for comparable measurements from the current connections.');
    if (qualityIssue(c) && evidence.every(old => qualityIssue(old!) === qualityIssue(c))) return {
      label: 'Quality impaired', tone: 'warning',
      description: `${direction === 'send' ? 'Sending' : 'Receiving'}: ${qualityIssue(c)} across consecutive measurements.`,
    };
  }
  if (connections.some(c => qualityIssue(c!))) return unknown('Checking whether a brief quality fluctuation persists.');
  const all = connections.flatMap(c => c!.tracks.filter(t => t.direction === c!.direction));
  if (!all.length || connections.some(c => c!.rttMs === null) || all.some(t => t.loss === null || t.jitterMs === null)) {
    return unknown('Some quality measurements or receiver feedback are unavailable. Available values are shown below.');
  }
  return {label: 'Media quality unremarkable', tone: 'good', description: 'Available loss, jitter and RTT measurements are within the dashboard’s reference ranges. This is not an end-to-end quality guarantee.'};
}
export function buildDashboard(view: MetricsView, seconds: number) {
  const latest = view.samples.at(-1);
  const end = latest?.timestamp ?? Date.now();
  const start = end - seconds * 1000;
  const samples = view.samples.filter(s => s.timestamp >= start);
  const series = ['audio', 'video'].flatMap(kind => directions.map(direction => ({kind, direction,
    current: number(rate(latest, direction, kind), kind === 'audio' ? 'kbit/s' : 'Mbit/s', kind === 'audio' ? 1 : 2), path: ''})));
  const maxima = {audio: Math.max(1, ...samples.flatMap(s => directions.map(d => rate(s, d, 'audio') ?? 0))),
    video: Math.max(1, ...samples.flatMap(s => directions.map(d => rate(s, d, 'video') ?? 0)))};
  for (const line of series) {
    let previous: MetricsSample | undefined, previousId: string | undefined;
    for (const sample of samples) {
      const value = rate(sample, line.direction, line.kind);
      const id = connectionFor(sample, line.direction)?.id;
      if (value === null) { previous = undefined; continue; }
      const move = !previous || previousId !== id || sample.timestamp - previous.timestamp > 3000;
      line.path += `${move ? 'M' : 'L'}${(48 + (sample.timestamp - start) / (seconds * 1000) * 504).toFixed(1)},${(156 - value / maxima[line.kind as 'audio' | 'video'] * 132).toFixed(1)} `;
      previous = sample; previousId = id;
    }
  }
  const rtt: MetricRow = {label: 'Roundtrip time (RTT)', help: 'Time for a round trip between your browser and the SFU. This is not end-to-end stream latency.',
    send: number(connectionFor(latest, 'send')?.error ? null : connectionFor(latest, 'send')?.rttMs ?? null, 'ms'),
    receive: number(connectionFor(latest, 'receive')?.error ? null : connectionFor(latest, 'receive')?.rttMs ?? null, 'ms')};
  return {latest, start, end, series, maxima, transport: transport(latest), quality: assessQuality(view.samples),
    audio: mediaRows(latest, 'audio'), video: mediaRows(latest, 'video'),
    tracks: {send: {audio: trackGroups(latest, 'send', 'audio'), video: trackGroups(latest, 'send', 'video')},
      receive: {audio: trackGroups(latest, 'receive', 'audio'), video: trackGroups(latest, 'receive', 'video')}},
    connections: directions.map(d => connectionDetails(latest, d)), rtt, events: view.events};
}
