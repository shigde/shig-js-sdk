import {assessQuality, buildDashboard, rate, trackGroups, connectionDetails} from './connection-dashboard.model';
import {ConnectionMetrics, MetricsSample} from '../../provider/webrtc-metrics.service';

function connection(direction: 'send' | 'receive'): ConnectionMetrics {
  return {id: direction, direction, state: 'connected', iceState: 'connected', rttMs: 24, route: 'host / host / udp',
    tracks: [{id: `${direction}-audio`, direction, kind: 'audio', bitrate: 64000, loss: 0, jitterMs: 5, fps: null, width: null, height: null, codec: 'audio/opus', limitation: null}]};
}
function samples(): MetricsSample[] {
  const now = Date.now();
  return [0, 1, 2].map(i => ({timestamp: now - (2 - i) * 1000, connections: [connection('send'), connection('receive')]}));
}
describe('Compact connection dashboard model', () => {
  it('keeps transport state separate from incomplete quality feedback and displays RTT prominently', () => {
    const history = samples();
    history.forEach(s => s.connections[0].tracks[0].loss = null);
    const model = buildDashboard({samples: history, events: []}, 60);
    expect(model.transport.label).toBe('Connection stable');
    expect(model.quality.tone).toBe('unknown');
    expect(model.rtt.send).toBe('24.0 ms');
    expect(model.rtt.receive).toBe('24.0 ms');
    expect(model.audio[1].send).toBe('—');
    expect(model.audio[1].receive).toBe('0.00 %');
  });
  it('assesses sustained packet loss but does not label a single spike as sustained impairment', () => {
    const history = samples();
    history[2].connections[0].tracks[0].loss = 0.08;
    expect(assessQuality(history).tone).toBe('unknown');
    history.forEach(s => s.connections[0].tracks[0].loss = 0.08);
    expect(assessQuality(history).label).toBe('Quality impaired');
    expect(assessQuality(history).description).toContain('Sending');
  });
  it('requires fresh comparable samples and never treats unavailable metrics as healthy', () => {
    expect(assessQuality(samples()).tone).toBe('good');
    expect(assessQuality(samples().slice(-1)).tone).toBe('unknown');
    const stale = samples().map(s => ({...s, timestamp: s.timestamp - 6000}));
    expect(assessQuality(stale).tone).toBe('unknown');
    const changed = samples(); changed[2].connections[0].id = 'new';
    expect(assessQuality(changed).tone).toBe('unknown');
  });
  it('shows persistent elevated RTT and CPU encoder limits as quality warnings', () => {
    const history = samples(); history.forEach(s => s.connections[1].rttMs = 350);
    expect(assessQuality(history).description).toContain('Receiving: Elevated roundtrip');
    history.forEach(s => { s.connections[1].rttMs = 24; s.connections[0].tracks[0].limitation = 'cpu'; });
    expect(assessQuality(history).tone).toBe('warning');
  });
  it('uses separate audio and video units, preserves zero and excludes unavailable tracks from totals', () => {
    const sample = samples()[0];
    expect(rate(sample, 'send', 'audio')).toBe(64);
    expect(rate(sample, 'send', 'video')).toBeNull();
    sample.connections[0].tracks[0].bitrate = 0;
    expect(rate(sample, 'send', 'audio')).toBe(0);
    sample.connections[0].tracks.push({...sample.connections[0].tracks[0], id: 'missing', bitrate: null});
    expect(rate(sample, 'send', 'audio')).toBeNull();
  });
  it('scopes history and leaves gaps after missing measurements or replaced connections', () => {
    const history = samples();
    history[1].connections[0].tracks[0].bitrate = null;
    history.unshift({...history[0], timestamp: history[0].timestamp - 120000});
    const model = buildDashboard({samples: history, events: []}, 60);
    const line = model.series.find(s => s.kind === 'audio' && s.direction === 'send')!;
    expect(line.path.match(/M/g)?.length).toBe(2);
    expect(line.path).not.toContain('NaN');
    expect(model.series.length).toBe(4);
  });
  it('keeps each named video track and its resolution, FPS and bitrate separate', () => {
    const sample = samples()[0];
    sample.connections[0].tracks = [
      {...sample.connections[0].tracks[0], id: 'me', kind: 'video', label: 'Me', width: 1280, height: 720, fps: 30, bitrate: 1000000},
      {...sample.connections[0].tracks[0], id: 'stream', kind: 'video', label: 'Stream', width: 1920, height: 1080, fps: 24, bitrate: 2000000},
    ];
    const groups = trackGroups(sample, 'send', 'video');
    expect(groups.map(t => t.label)).toEqual(['Me', 'Stream']);
    expect(groups[0].rows.find(r => r.label === 'Resolution')!.value).toBe('1280 × 720');
    expect(groups[1].rows.find(r => r.label === 'Resolution')!.value).toBe('1920 × 1080');
    expect(groups[1].rows.find(r => r.label === 'Frame rate')!.value).toBe('24 fps');
    expect(groups[0].rows.find(r => r.label === 'Data rate')!.value).toBe('1.00 Mbit/s');
    expect(trackGroups(sample, 'receive', 'video')).toEqual([]);
  });
  it('describes ICE network candidates instead of presenting host/host as participant roles', () => {
    const rows = connectionDetails(samples()[0], 'send').rows;
    expect(rows.find(r => r.label === 'Local ICE candidate')!.value).toBe('Host');
    expect(rows.find(r => r.label === 'Remote ICE candidate')!.value).toBe('Host');
    expect(rows.find(r => r.label === 'Transport protocol')!.value).toBe('UDP');
  });

  it('shows type and address on separate rows for each side without implying missing addresses are IPs', () => {
    const sample = samples()[0];
    sample.connections[0].localCandidate = {type: 'host', address: '192.0.2.1', protocol: 'udp'};
    sample.connections[0].remoteCandidate = {type: 'relay', address: '2001:db8::4', protocol: 'udp'};
    const rows = connectionDetails(sample, 'send').rows;
    expect(rows.find(r => r.label === 'Local ICE candidate')!.value).toBe('Host');
    expect(rows.find(r => r.label === 'Local IP / hostname')!.value).toBe('192.0.2.1');
    expect(rows.find(r => r.label === 'Remote ICE candidate')!.value).toBe('TURN relay');
    expect(rows.find(r => r.label === 'Remote IP / hostname')!.value).toBe('2001:db8::4');
    expect(connectionDetails(sample, 'receive').rows.find(r => r.address)!.value).toBe('Not available');
  });

});
