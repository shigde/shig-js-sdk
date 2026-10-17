import {EventEmitter} from '@angular/core';
import {LobbyMedia, LobbyMediaEvent, LobbyMediaIndex, LobbyMediaPurpose, SdpMediaInfo} from '../entities';
import {SdpParser} from './sdp-parser';
import {extractPeerId} from './id-parser';
import {createLogger} from './logger';


export class WebrtcConnection extends EventEmitter<LobbyMediaEvent> {
  private readonly log = createLogger('WebrtcConnection');
  private readonly pc: RTCPeerConnection;
  private readonly remoteMedia: Map<LobbyMediaIndex, LobbyMedia> = new Map<LobbyMediaIndex, LobbyMedia>();
  private dataChannel: RTCDataChannel | undefined;
  private readonly localSenders = new Map<LobbyMediaPurpose, RTCRtpSender[]>();

  constructor(
    private readonly config: RTCConfiguration,
    private readonly type: 'ingress' | 'egress'
  ) {
    super(true);
    this.pc = new RTCPeerConnection(this.config);
    this.pc.ontrack = (ev: RTCTrackEvent) => this.onTrack(ev);
    this.pc.onsignalingstatechange = _ => this.onSignalStateChange();
    this.pc.oniceconnectionstatechange = _ => this.log.info('oniceconnectionstatechange');
    this.pc.onicecandidate = event => this.onicecandidate(event);
    this.pc.onnegotiationneeded = _ => this.log.info('onnegotiationneeded');
    this.pc.ondatachannel = (event) => {
      this.log.info('receive on channel event', event);
      this.dataChannel = event.channel;
      this.dataChannel.onmessage = () => this.onReceiveChannelMessageCallback;
      this.dataChannel.onopen = () => this.onReceiveChannelStateChange;
      this.dataChannel.onclose = () => this.onReceiveChannelStateChange;
    };
  }

  public createDataChannel(label: 'whip' | 'whep'): RTCDataChannel {
    this.dataChannel = this.pc.createDataChannel(label);
    this.dataChannel.onmessage = this.onReceiveChannelMessageCallback;
    this.dataChannel.onopen = () => this.onReceiveChannelStateChange;
    this.dataChannel.onclose = () => this.onReceiveChannelStateChange;
    return this.dataChannel;
  }

  public async createOffer(streams: Map<LobbyMediaPurpose, MediaStream>, info: string): Promise<RTCSessionDescription> {
    const trackInfo = new Map<string, SdpMediaInfo>();
    const senderParameterUpdates: Promise<void>[] = [];

    streams.forEach((ms, streamType) => {
      const senders: RTCRtpSender[] = [];
      this.localSenders.set(streamType, senders);
      let streamId = ms.id;
      ms.getTracks().forEach((track) => {

        if (streamType === LobbyMediaPurpose.STREAM) {
          const transceiver = this.pc.addTransceiver(track, {
            direction: 'sendonly'
          });
          transceiver.sender.setStreams(ms);
          senders.push(transceiver.sender);

          if (track.kind === 'video') {
            senderParameterUpdates.push(this.configureVideoSender(transceiver.sender));
          }

          if (track.kind === 'audio') {
            const audioCodecs = RTCRtpSender.getCapabilities('audio')!.codecs;

            // Only OPUS for the stream audio
            const opusCodecs = audioCodecs
              .filter(c => c.mimeType.toLowerCase() === 'audio/opus')
              .map(c => ({
                ...c,
                sdpFmtpLine: 'minptime=10;useinbandfec=1'
              }));

            if (opusCodecs.length === 0) {
              throw new Error('Browser does not support opus codec for audio track.');
            }
            transceiver.setCodecPreferences(opusCodecs);
          }
        } else {
          const sender = this.pc.addTrack(track, ms);
          senders.push(sender);
          if (track.kind === 'video') {
            senderParameterUpdates.push(this.configureVideoSender(sender));
          }
        }

        trackInfo.set(`${streamId} ${track.id}`.trim(), {
          purpose: streamType,
          muted: !track.enabled,
          info: info
        });
      });
    });

    await Promise.all(senderParameterUpdates);

    // @ts-ignore
    return this.pc.createOffer()
      .then((offer) => this.pc.setLocalDescription(offer))
      .then(_ => {
        return SdpParser.mungeOfferInfo(this.pc.localDescription as RTCSessionDescription, trackInfo);
      });
  }

  public async replaceStream(purpose: LobbyMediaPurpose, stream: MediaStream): Promise<void> {
    const senders = this.localSenders.get(purpose);
    const tracks = stream.getTracks();
    if (!senders || senders.length !== tracks.length) {
      throw new Error('Device change requires the same negotiated media kinds.');
    }
    const replacements = senders.map(sender => {
      const previous = sender.track;
      const track = tracks.find(candidate => candidate.kind === previous?.kind);
      if (!previous || !track) {
        throw new Error('No matching track for the negotiated sender.');
      }
      track.enabled = previous.enabled;
      return {sender, previous, track};
    });
    const replaced: typeof replacements = [];
    try {
      for (const replacement of replacements) {
        await replacement.sender.replaceTrack(replacement.track);
        replaced.push(replacement);
      }
    } catch (error) {
      // A failed second replacement must not leave audio and video on different devices.
      for (const replacement of replaced.reverse()) {
        await replacement.sender.replaceTrack(replacement.previous);
      }
      throw error;
    }
  }

  private async configureVideoSender(sender: RTCRtpSender): Promise<void> {
    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
    parameters.encodings[0] = {
      ...parameters.encodings[0],
      maxBitrate: 10_000_000,
      maxFramerate: 30,
      scaleResolutionDownBy: 1,
    };
    (parameters as any).degradationPreference = 'maintain-resolution';

    try {
      await sender.setParameters(parameters);
    } catch (error) {
      this.log.warn('failed to configure video sender parameters', error);
    }
  }

  // Ice Gathering ----------------------------
  private onicecandidate(event: RTCPeerConnectionIceEvent): void {
    if (event.candidate !== null) {
      // send ice to sfu
    } else {
      return;
    }
  }

  public setAnswer(answer: RTCSessionDescription): Promise<void> {
    this.log.info('setAnswer: ', answer);
    return this.pc.setRemoteDescription(answer);
  }

  public setRemoteOffer(offer: RTCSessionDescription) {
    let aw: RTCSessionDescriptionInit;
    this.beforeRemoteOffer(offer);
    return this.pc.setRemoteDescription(offer)
      .then(() => this.pc.createAnswer())
      .then((answer) => aw = answer)
      .then((_) => this.pc.setLocalDescription(aw))
      .then(() => aw);
  }

  public close(): Promise<void> {
    this.localSenders.clear();
    if (this.dataChannel !== undefined) {
      this.dataChannel.onmessage = null;
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;

      if (this.dataChannel.readyState === 'connecting' || this.dataChannel.readyState === 'open') {
        this.dataChannel.close();
      }

      this.dataChannel = undefined;
    }

    this.pc.getTransceivers().forEach((transceiver) => {
      transceiver.stop();
    });

    this.pc.ontrack = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.onconnectionstatechange = null;
    this.pc.onsignalingstatechange = null;
    this.pc.onicecandidate = null;
    this.pc.onnegotiationneeded = null;
    return new Promise<void>((resolve) => {
      this.pc.close();
      resolve();
    });
  }

  private onReceiveChannelMessageCallback(ev: MessageEvent<any>): void {
    this.log.warn('onReceiveChannelMessageCallback not set', ev);
  }

  private onReceiveChannelStateChange(ev: Event): void {
    this.log.warn('onReceiveChannelStateChange not set', ev);
  }

  private onTrack(ev: RTCTrackEvent): void {
    if (ev.transceiver.mid === null) {
      return;
    }
    const media = this.remoteMedia.get(Number(ev.transceiver.mid));
    const track = ev.track;
    const stream = ev.streams[0];
    if (media !== undefined) {
      this.remoteMedia.set(media.mediaIndex, media);
      this.emit({type: 'add', media, track, stream});
    }
    if (media === undefined) {
      this.log.error('an transceiver without a media should not exits', ev.transceiver.mid, this.remoteMedia);
    }
  }

  private onSignalStateChange() {
    this.log.info(`signal state: ${this.pc.signalingState}`);
    this.logTransceiversState(this.pc.signalingState);
    if (this.pc.signalingState === 'have-remote-offer') {
      this.onRemoteOffer(this.pc.remoteDescription);
    }
  }

  private beforeRemoteOffer(sdp: RTCSessionDescription): void {
    const mediaLines = SdpParser.getSdpMediaLine(sdp);
    mediaLines.forEach((line) => {
      const media = this.remoteMedia.get(line.mid);
      const peer = extractPeerId(line.trackId);
      const updateMedia: LobbyMedia = {
        peerId: peer,
        mediaIndex: line.mid,
        purpose: line.purpose,
        info: line.info,
        kind: line.kind,
        muted: line.muted,
        trackId: line.trackId,
        streamId: line.streamId,
      };

      if ((line.direction === 'inactive' || line.direction === 'recvonly') && !!media) {
        updateMedia.trackId = media.trackId;
        updateMedia.streamId = media.streamId;
        updateMedia.peerId = media.peerId;
        this.remoteMedia.set(line.mid, updateMedia);
      }

      if (line.direction !== 'inactive' && line.direction !== 'recvonly') {
        this.remoteMedia.set(line.mid, updateMedia);
      }
    });
  }

  private onRemoteOffer(sdp: RTCSessionDescription | null): void {
    const mediaLines = SdpParser.getSdpMediaLine(sdp);
    mediaLines.forEach((line) => {
      const media = this.remoteMedia.get(line.mid);
      if ((line.direction === 'inactive' || line.direction === 'recvonly') && !!media) {
        this.remoteMedia.delete(line.mid);
        this.emit({type: 'remove', media});
      }
    });
  }

  public muteRemoteMedia(mid: string, mute: boolean) {
    const media = this.remoteMedia.get(Number(mid));
    this.log.info('muteRemoteMedia', this.type);
    if (!!media) {
      media.muted = mute;
      this.remoteMedia.set(Number(mid), media);
      this.emit({type: 'mute', media});
    }
  }

  public getMid(trackId: string): string | null {
    const tsList = this.pc.getTransceivers();
    for (let transceiver of tsList) {
      const track = transceiver.sender.track;
      if (!!track && track.id === trackId) {
        return transceiver.mid;
      }
    }
    return null;
  }

  private logTransceiversState(sdpState: string): void {
    this.pc.getTransceivers().forEach((t) => {
      this.log.debug(`transceiver:
            state: ${sdpState}
            mid: ${t.mid}
            direction: ${t.direction}
            track: ${t.receiver.track.id}
            kind: ${t.receiver.track.kind}
            muted: ${t.receiver.track.muted}
            enabled: ${t.receiver.track.enabled}
            state: ${t.receiver.track.readyState}
            `
      );
    });
  }
}
