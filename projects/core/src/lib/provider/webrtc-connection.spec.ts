import {LobbyMediaPurpose} from '../entities';
import {SdpParser} from './sdp-parser';
import {WebrtcConnection} from './webrtc-connection';

describe('WebrtcConnection device replacement', () => {
  let connection: WebrtcConnection;
  let senders: RTCRtpSender[];
  let codecPreferences: jasmine.Spy[];

  const track = (kind: string, enabled = true) => ({kind, enabled, id: Math.random().toString()}) as MediaStreamTrack;
  const stream = (...tracks: MediaStreamTrack[]) => ({id: Math.random().toString(), getTracks: () => tracks}) as MediaStream;

  beforeEach(() => {
    senders = [];
    codecPreferences = [];
    spyOn(RTCRtpSender, 'getCapabilities').and.returnValue({headerExtensions: [], codecs: [
      {mimeType: 'video/VP8', clockRate: 90000},
      {mimeType: 'video/H264', clockRate: 90000},
      {mimeType: 'video/rtx', clockRate: 90000},
    ]});
    const addSender = (track: MediaStreamTrack) => {
      const sender = {
        track,
        getParameters: () => ({encodings: [{}]}),
        setParameters: async () => {},
        setStreams: () => {},
        replaceTrack: jasmine.createSpy('replaceTrack').and.callFake(async (next: MediaStreamTrack) => {
          sender.track = next;
        }),
      };
      senders.push(sender as unknown as RTCRtpSender);
      return sender;
    };
    const pc = {
      addTrack: addSender,
      addTransceiver: (track: MediaStreamTrack) => {
        const setCodecPreferences = jasmine.createSpy('setCodecPreferences');
        codecPreferences.push(setCodecPreferences);
        return {sender: addSender(track), setCodecPreferences};
      },
      createOffer: jasmine.createSpy('createOffer').and.resolveTo({type: 'offer', sdp: 'v=0'}),
      setLocalDescription: async () => {},
      localDescription: {type: 'offer', sdp: 'v=0'},
    };
    spyOn(window, 'RTCPeerConnection').and.returnValue(pc as unknown as RTCPeerConnection);
    spyOn(SdpParser, 'mungeOfferInfo').and.callFake(offer => offer);
    connection = new WebrtcConnection({}, 'ingress');
  });

  it('offers only H.264 video and RTX for the stream, without restricting guest codecs', async () => {
    await connection.createOffer(new Map([
      [LobbyMediaPurpose.GUEST, stream(track('video'))],
      [LobbyMediaPurpose.STREAM, stream(track('video'))],
    ]), 'Host');
    expect(codecPreferences.length).toBe(1);
    expect(codecPreferences[0]).toHaveBeenCalledOnceWith([
      {mimeType: 'video/H264', clockRate: 90000},
      {mimeType: 'video/rtx', clockRate: 90000},
    ]);
  });

  it('rejects stream publishing instead of falling back to VP8 when H.264 is missing', async () => {
    (RTCRtpSender.getCapabilities as jasmine.Spy).and.returnValue({codecs: [
      {mimeType: 'video/VP8', clockRate: 90000},
    ]});
    await expectAsync(connection.createOffer(new Map([
      [LobbyMediaPurpose.STREAM, stream(track('video'))],
    ]), 'Host')).toBeRejectedWithError('This browser cannot publish the stream using H.264.');
    expect(codecPreferences[0]).not.toHaveBeenCalled();
  });

  it('replaces only guest senders, preserves mute and keeps the negotiated MID', async () => {
    const audio = track('audio', false);
    const video = track('video');
    const mixed = track('video');
    await connection.createOffer(new Map([
      [LobbyMediaPurpose.GUEST, stream(audio, video)],
      [LobbyMediaPurpose.STREAM, stream(mixed)],
    ]), 'Guest');
    const nextAudio = track('audio');
    const nextVideo = track('video');
    await connection.replaceStream(LobbyMediaPurpose.GUEST, stream(nextAudio, nextVideo));
    expect(senders[0].track).toBe(nextAudio);
    expect(nextAudio.enabled).toBeFalse();
    expect(senders[1].track).toBe(nextVideo);
    expect(senders[2].track).toBe(mixed);
    expect(senders[2].replaceTrack).not.toHaveBeenCalled();
  });

  it('restores the previous tracks if a replacement fails', async () => {
    const audio = track('audio');
    const video = track('video');
    await connection.createOffer(new Map([[LobbyMediaPurpose.GUEST, stream(audio, video)]]), 'Guest');
    (senders[1].replaceTrack as jasmine.Spy).and.rejectWith(new Error('replacement failed'));
    await expectAsync(connection.replaceStream(LobbyMediaPurpose.GUEST, stream(track('audio'), track('video'))))
      .toBeRejected();
    expect(senders[0].track).toBe(audio);
    expect(senders[1].track).toBe(video);
  });

  it('rejects changed media kinds before changing a sender', async () => {
    await connection.createOffer(new Map([[LobbyMediaPurpose.GUEST, stream(track('audio'), track('video'))]]), 'Guest');
    await expectAsync(connection.replaceStream(LobbyMediaPurpose.GUEST, stream(track('audio')))).toBeRejected();
    expect(senders[0].replaceTrack).not.toHaveBeenCalled();
  });
});
