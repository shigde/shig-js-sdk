import {LobbyMediaPurpose} from '../entities';
import {SdpParser} from './sdp-parser';
import {WebrtcConnection} from './webrtc-connection';

describe('WebrtcConnection device replacement', () => {
  let connection: WebrtcConnection;
  let senders: RTCRtpSender[];

  const track = (kind: string, enabled = true) => ({kind, enabled, id: Math.random().toString()}) as MediaStreamTrack;
  const stream = (...tracks: MediaStreamTrack[]) => ({id: Math.random().toString(), getTracks: () => tracks}) as MediaStream;

  beforeEach(() => {
    senders = [];
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
      addTransceiver: (track: MediaStreamTrack) => ({sender: addSender(track)}),
      createOffer: jasmine.createSpy('createOffer').and.resolveTo({type: 'offer', sdp: 'v=0'}),
      setLocalDescription: async () => {},
      localDescription: {type: 'offer', sdp: 'v=0'},
    };
    spyOn(window, 'RTCPeerConnection').and.returnValue(pc as unknown as RTCPeerConnection);
    spyOn(SdpParser, 'mungeOfferInfo').and.callFake(offer => offer);
    connection = new WebrtcConnection({}, 'ingress');
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
