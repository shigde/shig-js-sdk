import {ChannelMsgType, LobbyMediaPurpose} from '../entities';
import {environment} from '../../environments/environment';
import {ChannelMessenger} from './channel-messenger';
import {WebrtcConnection} from './webrtc-connection';

export class DeviceConnection {
  private readonly ingress = new WebrtcConnection({
    bundlePolicy: 'max-bundle',
    iceServers: environment.iceServers,
  }, 'ingress');
  private readonly messenger = new ChannelMessenger(this.ingress.createDataChannel('whip'));

  constructor(onReady: () => void, onClosed: () => void) {
    this.messenger.subscribe(message => {
      if (message.type !== ChannelMsgType.HostStatus) return;
      if (message.data === 'present') onReady();
      else if (message.data === 'closed') onClosed();
    });
    this.messenger.closed$.subscribe(onClosed);
  }

  offer(media: MediaStream, name: string): Promise<RTCSessionDescription> {
    return this.ingress.createOffer(new Map([[LobbyMediaPurpose.GUEST, media]]), name.replace(/[\r\n]/g, ' '), true);
  }

  answer(sdp: string): Promise<void> {
    return this.ingress.setAnswer({type: 'answer', sdp});
  }

  replaceStream(media: MediaStream): Promise<void> {
    return this.ingress.replaceStream(LobbyMediaPurpose.GUEST, media);
  }

  mute(track: MediaStreamTrack, mute: boolean): void {
    track.enabled = !mute;
    const mid = this.ingress.getMid(track.id);
    if (mid !== null) {
      this.messenger.send({type: ChannelMsgType.MuteMsg, id: 0, data: {mid, mute}});
    }
  }

  async close(): Promise<void> {
    try {
      this.messenger.close();
    } finally {
      this.messenger.complete();
      await this.ingress.close();
    }
  }
}
