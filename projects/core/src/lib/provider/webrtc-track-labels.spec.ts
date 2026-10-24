import {LobbyMediaPurpose} from '../entities';
import {SdpParser} from './sdp-parser';
import {WebrtcConnection} from './webrtc-connection';
import {TrackLabelResolver, WebrtcMetricsService} from './webrtc-metrics.service';

describe('WebRTC metric track identity', () => {
  it('labels reordered outgoing stats by negotiated sender, including after device replacement', async () => {
    const transceivers: any[] = [];
    const senderFor = (track: MediaStreamTrack) => ({track, getParameters: () => ({encodings: [{}]}),
      setParameters: async () => {}, setStreams: () => {}, replaceTrack: async function(next: MediaStreamTrack) {this.track = next;}});
    const add = (track: MediaStreamTrack) => {
      const sender = senderFor(track); const transceiver = {mid: String(transceivers.length), sender};
      transceivers.push(transceiver); return transceiver;
    };
    const pc = {getTransceivers: () => transceivers, addTrack: (track: MediaStreamTrack) => add(track).sender,
      addTransceiver: add, createOffer: async () => ({type: 'offer', sdp: 'v=0'}), setLocalDescription: async () => {},
      localDescription: {type: 'offer', sdp: 'v=0'}};
    spyOn(window, 'RTCPeerConnection').and.returnValue(pc as unknown as RTCPeerConnection);
    spyOn(SdpParser, 'mungeOfferInfo').and.callFake(offer => offer);
    let label!: TrackLabelResolver;
    const metrics = {register: (_pc: RTCPeerConnection, _direction: string, resolve: TrackLabelResolver) => {label = resolve; return () => {};}};
    const connection = new WebrtcConnection({}, 'ingress', metrics as unknown as WebrtcMetricsService);
    const track = (id: string) => ({id, kind: 'video', enabled: true}) as MediaStreamTrack;
    const stream = (video: MediaStreamTrack) => ({id: video.id, getTracks: () => [video]}) as MediaStream;
    await connection.createOffer(new Map([[LobbyMediaPurpose.GUEST, stream(track('camera'))], [LobbyMediaPurpose.STREAM, stream(track('mix'))]]), 'Host');
    expect(label({mid: '1'}, 'send')).toBe('Stream');
    expect(label({mid: '0'}, 'send')).toBe('Me');
    expect(label({mid: 'unknown'}, 'send')).toBeUndefined();
    await connection.replaceStream(LobbyMediaPurpose.GUEST, stream(track('new-camera')));
    expect(label({mid: '0'}, 'send')).toBe('Me');
    expect(label({track: {trackIdentifier: 'new-camera'}}, 'send')).toBe('Me');
  });
  it('labels incoming guest and mixed stream media using their negotiated SDP metadata', async () => {
    const pc = {getTransceivers: () => [], setRemoteDescription: async () => {},
      createAnswer: async () => ({type: 'answer', sdp: 'v=0'}), setLocalDescription: async () => {}};
    spyOn(window, 'RTCPeerConnection').and.returnValue(pc as unknown as RTCPeerConnection);
    spyOn(SdpParser, 'getSdpMediaLine').and.returnValue([
      {mid: 0, trackId: 'guest-audio', streamId: 'guest', purpose: LobbyMediaPurpose.GUEST, info: 'Alex', kind: 'audio', muted: false, direction: 'sendonly', ssrcs: []},
      {mid: 1, trackId: 'mixed-video', streamId: 'mix', purpose: LobbyMediaPurpose.STREAM, info: 'Host', kind: 'video', muted: false, direction: 'sendonly', ssrcs: []},
    ]);
    let label!: TrackLabelResolver;
    const metrics = {register: (_pc: RTCPeerConnection, _direction: string, resolve: TrackLabelResolver) => {label = resolve; return () => {};}};
    const connection = new WebrtcConnection({}, 'egress', metrics as unknown as WebrtcMetricsService);
    await connection.setRemoteOffer({type: 'offer', sdp: 'v=0'} as RTCSessionDescription);
    expect(label({mid: '1'}, 'receive')).toBe('Stream');
    expect(label({mid: '0'}, 'receive')).toBe('Alex');
    expect(label({mid: 'unknown'}, 'receive')).toBeUndefined();
  });

});
