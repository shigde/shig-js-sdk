import {fakeAsync, tick} from '@angular/core/testing';
import {NgZone} from '@angular/core';
import {MetricsView, parseConnectionMetrics, WebrtcMetricsService} from './webrtc-metrics.service';

const pc = () => ({connectionState: 'connected', iceConnectionState: 'connected'} as RTCPeerConnection);

describe('WebRTC metrics normalization', () => {
  it('preserves unavailable rates instead of presenting zero loss or bitrate', () => {
    const metrics = parseConnectionMetrics('send', {pc: pc(), direction: 'send'}, {
      video: {outbound: [{id: 'video', kind: 'video'}]},
    });
    expect(metrics.tracks[0].bitrate).toBeNull();
    expect(metrics.tracks[0].loss).toBeNull();
    expect(metrics.tracks[0].jitterMs).toBeNull();
    expect(metrics.rttMs).toBeNull();
  });

  it('maps incoming rates, seconds to milliseconds, codecs and selected ICE candidate addresses', () => {
    const metrics = parseConnectionMetrics('receive', {pc: pc(), direction: 'receive'}, {
      audio: {inbound: [{id: 'audio', bitrate: 128000, packetLossRate: 0, jitter: 0.012, mimeType: 'audio/opus'}]},
      connection: {currentRoundTripTime: 0.045, local: {candidateType: 'relay', protocol: 'udp', address: '192.0.2.1'},
        remote: {candidateType: 'host', address: '192.0.2.2'}},
    });
    expect(metrics.tracks[0].jitterMs).toBe(12);
    expect(metrics.tracks[0].loss).toBe(0);
    expect(metrics.rttMs).toBe(45);
    expect(metrics.route).toBe('relay / host / udp');
    expect(metrics.localCandidate?.address).toBe('192.0.2.1');
    expect(metrics.remoteCandidate?.address).toBe('192.0.2.2');
    expect(metrics.localCandidate?.type).toBe('relay');
  });

  it('preserves IPv6 and hostnames and handles absent or legacy address fields', () => {
    const registration = {pc: pc(), direction: 'receive' as const};
    const metrics = parseConnectionMetrics('receive', registration, {connection: {
      local: {address: 'peer.local', candidateType: 'host'}, remote: {address: '2001:db8::1', candidateType: 'host'},
    }});
    expect(metrics.localCandidate?.address).toBe('peer.local');
    expect(metrics.remoteCandidate?.address).toBe('2001:db8::1');
    expect(parseConnectionMetrics('receive', registration, {}).localCandidate?.address).toBeNull();
    expect(parseConnectionMetrics('receive', registration, {connection: {local: {ip: '192.0.2.5'}}}).localCandidate?.address).toBe('192.0.2.5');
  });

  it('uses matching receiver feedback for outgoing loss and jitter', () => {
    const metrics = parseConnectionMetrics('send', {pc: pc(), direction: 'send'}, {
      video: {outbound: [{id: 'sent', ssrc: 12, bitrate: 1000000, packetLossRate: 0, jitter: 0}]},
      remote: {video: {inbound: [{localId: 'another', ssrc: 13, fractionLost: 0.9},
        {localId: 'sent', fractionLost: 0.02, jitter: 0.015}]}},
    });
    expect(metrics.tracks[0].loss).toBe(0.02);
    expect(metrics.tracks[0].jitterMs).toBe(15);
  });

  it('rejects non-finite and negative browser values', () => {
    const metrics = parseConnectionMetrics('receive', {pc: pc(), direction: 'receive'}, {
      video: {inbound: [{id: 'v', bitrate: NaN, jitter: -1, packetLossRate: Infinity}]},
    });
    expect(metrics.tracks[0].bitrate).toBeNull();
    expect(metrics.tracks[0].jitterMs).toBeNull();
    expect(metrics.tracks[0].loss).toBeNull();
  });
});

describe('WebRTC metrics lifecycle', () => {
  let service: WebrtcMetricsService;
  let latest: MetricsView;
  let stats: (event: Record<string, unknown>) => void;
  let collector: {on: jasmine.Spy; addConnection: jasmine.Spy; removeConnection: jasmine.Spy; clearTimeline: jasmine.Spy; destroy: jasmine.Spy};
  let create: jasmine.Spy;
  beforeEach(() => {
    service = new WebrtcMetricsService(new NgZone({enableLongStackTrace: false}));
    collector = {on: jasmine.createSpy().and.callFake((_name, callback) => stats = callback),
      addConnection: jasmine.createSpy().and.returnValue(Promise.resolve({connectionId: 'connection-1'})),
      removeConnection: jasmine.createSpy(), clearTimeline: jasmine.createSpy(), destroy: jasmine.createSpy()};
    create = spyOn<any>(service, 'createCollector').and.returnValue(collector);
    service.view$.subscribe(value => latest = value);
  });
  afterEach(() => service.ngOnDestroy());

  it('starts on demand and releases the collector only when the last dashboard closes', fakeAsync(() => {
    const remove = service.register(pc(), 'send');
    expect(create).not.toHaveBeenCalled();
    const close = service.observe();
    const closeOther = service.observe();
    expect(create).toHaveBeenCalledTimes(1);
    expect(collector.addConnection).toHaveBeenCalledTimes(1);
    tick(1000);
    expect(latest.samples.length).toBe(1);
    close();
    expect(collector.destroy).not.toHaveBeenCalled();
    closeOther();
    closeOther();
    expect(collector.destroy).toHaveBeenCalledTimes(1);
    expect(latest.samples.length).toBe(0);
    remove();
  }));

  it('expires stale measurements and bounds history and events', fakeAsync(() => {
    service.register(pc(), 'receive');
    const close = service.observe();
    stats({connectionId: 'connection-1', data: {audio: {inbound: [{id: 'a', bitrate: 1000}]}}});
    tick(1000);
    expect(latest.samples.at(-1)!.connections[0].tracks[0].bitrate).toBe(1000);
    tick(5000);
    expect(latest.samples.at(-1)!.connections[0].tracks).toEqual([]);
    expect(latest.samples.at(-1)!.connections[0].error).toBeTruthy();
    tick(610000);
    expect(latest.samples.length).toBeLessThanOrEqual(600);
    expect(latest.events.length).toBeLessThanOrEqual(50);
    expect(collector.clearTimeline).toHaveBeenCalled();
    close();
  }));

  it('handles connections appearing after opening, late results, closing and reconnecting', fakeAsync(() => {
    const close = service.observe();
    expect(create).not.toHaveBeenCalled();
    const remove = service.register(pc(), 'send');
    expect(create).toHaveBeenCalledTimes(1);
    const oldStats = stats;
    remove(); remove();
    expect(collector.removeConnection).toHaveBeenCalledTimes(1);
    oldStats({connectionId: 'connection-1', data: {}});
    expect(latest.samples).toEqual([]);
    const removeNext = service.register(pc(), 'send');
    expect(create).toHaveBeenCalledTimes(2);
    tick(1000);
    expect(latest.samples.at(-1)!.connections[0].id).toBe('connection-2');
    removeNext();
    close();
  }));
  it('keeps publishing for a visible detached view and pauses when no view is visible', fakeAsync(() => {
    service.register(pc(), 'receive');
    let visible = false;
    const close = service.observe(() => visible);
    tick(1000);
    expect(latest.samples.length).toBe(0);
    visible = true;
    tick(1000);
    expect(latest.samples.length).toBe(1);
    visible = false;
    tick(1000);
    expect(latest.samples.length).toBe(1);
    close();
  }));
});

describe('PeerMetrics collector integration' , () => {
  it('normalizes actual collector output and calculates consecutive browser report rates', fakeAsync(() => {
    const connection = new RTCPeerConnection();
    const service = new WebrtcMetricsService(new NgZone({enableLongStackTrace: false}));
    let latest: MetricsView = {samples: [], events: []};
    let count = 0;
    spyOn(connection, 'getStats').and.callFake(() => {
      count++;
      return Promise.resolve(new Map([
        ['rtp', {id: 'rtp', type: 'inbound-rtp', kind: 'audio', timestamp: count * 1000,
          bytesReceived: count * 1000, packetsReceived: count * 10, packetsLost: 0, jitter: 0.01, transportId: 'transport'}],
        ['transport', {id: 'transport', type: 'transport', selectedCandidatePairId: 'pair'}],
        ['pair', {id: 'pair', type: 'candidate-pair', nominated: true, state: 'succeeded', currentRoundTripTime: 0.03}],
      ]) as unknown as RTCStatsReport);
    });
    service.view$.subscribe(view => latest = view);
    const remove = service.register(connection, 'receive');
    const close = service.observe();
    tick(3500);
    const metrics = latest.samples.at(-1)!.connections[0];
    expect(metrics.error).toBeUndefined();
    expect(metrics.tracks[0].bitrate).toBe(8000);
    expect(metrics.tracks[0].loss).toBe(0);
    expect(metrics.tracks[0].jitterMs).toBe(10);
    expect(metrics.rttMs).toBe(30);
    remove(); close(); service.ngOnDestroy(); connection.close();
    tick(1000); // The upstream collector releases its idle timers on their next tick.
  }));
});
