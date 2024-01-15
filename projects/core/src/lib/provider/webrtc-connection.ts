import {EventEmitter} from '@angular/core';
import {ChannelMsg, ChannelMsgType, LobbyMedia, LobbyMediaEvent, LobbyMediaIndex, LobbyMediaType} from '../entities';
import {SdpParser} from './sdp-parser';

export class WebrtcConnection extends EventEmitter<LobbyMediaEvent> {
    private readonly pc: RTCPeerConnection;
    private readonly remoteMedia: Map<LobbyMediaIndex, LobbyMedia> = new Map<LobbyMediaIndex, LobbyMedia>();
    private dataChannel: RTCDataChannel | undefined;

    constructor(
        private readonly config: RTCConfiguration
    ) {
        super(true);
        this.pc = new RTCPeerConnection(this.config);
        this.pc.ontrack = (ev: RTCTrackEvent) => this.onTrack(ev);
        this.pc.onsignalingstatechange = _ => this.onSignalStateChange();
        this.pc.oniceconnectionstatechange = _ => console.log('oniceconnectionstatechange');
        this.pc.onicecandidate = event => this.onicecandidate(event);
        this.pc.onnegotiationneeded = _ => console.log('onnegotiationneeded');
        this.pc.ondatachannel = (event) => {
            console.log('Receive Channel Callback');
            this.dataChannel = event.channel;
            this.dataChannel.onmessage = this.onReceiveChannelMessageCallback;
            this.dataChannel.onopen = this.onReceiveChannelStateChange;
            this.dataChannel.onclose = this.onReceiveChannelStateChange;
        };
    }

    public createDataChannel(): RTCDataChannel {
        this.dataChannel = this.pc.createDataChannel('whep');
        this.dataChannel.onmessage = this.onReceiveChannelMessageCallback;
        this.dataChannel.onopen = this.onReceiveChannelStateChange;
        this.dataChannel.onclose = this.onReceiveChannelStateChange;
        return this.dataChannel;
    }

    public createOffer(streams: Map<LobbyMediaType, MediaStream>): Promise<RTCSessionDescription> {
        const trackInfo = new Map<string, LobbyMediaType>();
        streams.forEach((ms, streamType) => {
            let streamId = ms.id;
            ms.getTracks().forEach((track) => {
                this.pc.addTrack(track, ms);
                trackInfo.set(`${streamId} ${track.id}`.trim(), streamType);
            });
        });

        // @ts-ignore
        return this.pc.createOffer()
            .then((offer) => this.pc.setLocalDescription(offer))
            .then(_ => SdpParser.mungeOfferInfo(this.pc.localDescription as RTCSessionDescription, trackInfo));
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
        console.log('Answer:', answer);
        return this.pc.setRemoteDescription(answer);
    }

    public setRemoteOffer(offer: RTCSessionDescription) {
        let aw: RTCSessionDescriptionInit;
        return this.pc.setRemoteDescription(offer)
            .then(() => this.pc.createAnswer())
            .then((answer) => aw = answer)
            .then((_) => this.pc.setLocalDescription(aw))
            .then(() => aw);
    }


    public close(): Promise<void> {
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

    private onReceiveChannelMessageCallback(me: MessageEvent<any>): void {
        const msg = JSON.parse(new TextDecoder().decode(me.data as ArrayBuffer)) as ChannelMsg;
        if (msg?.type === ChannelMsgType.OfferMsg) {

        }
    }

    private onReceiveChannelStateChange(ev: Event): void {
        console.log('onReceiveChannelStateChange', ev);
    }

    private onTrack(ev: RTCTrackEvent): void {
        if (ev.transceiver.mid === null) {
            return
        }
        const media = this.remoteMedia.get(ev.transceiver.mid);
        const track = ev.track;
        const stream = ev.streams[0];
        if (media !== undefined) {
            media.streamId = stream.id;
            media.trackId = track.id;
            this.remoteMedia.set(media.mediaIndex, media);
            this.emit({type: 'add', media, track, stream});
        }
    }

    private onSignalStateChange() {
        console.log(`signal state: ${this.pc.signalingState}`);
        if (this.pc.signalingState === 'have-remote-offer') {
            this.onRemoteOffer();
        }
    }

    private onRemoteOffer() {
        const mediaLines = SdpParser.getSdpMediaLine(this.pc.remoteDescription);
        mediaLines.forEach((line) => {
            const tc = this.pc.getTransceivers().find((t) => t.mid === line.mid);
            const track = tc?.receiver.track;
            const media = this.remoteMedia.get(line.mid);

            if (line.direction === 'inactive' && media !== undefined) {
                this.remoteMedia.delete(line.mid);
                this.emit({type: 'remove', media, track});
            }
            if (line.direction === 'recvonly' && media === undefined) {
                // @ts-ignore
                if (track?.id !== media.trackId) {
                    throw new Error('Inconsistent media state');
                }
            }
            if (line.direction === 'recvonly' && media !== undefined) {
                this.remoteMedia.set(line.mid, {
                    mediaIndex: line.mid,
                    mediaType: line.mediaType,
                    info: line.info,
                    kind: line.kind,
                    muted: true,
                    trackId: (track) ? track.id : '-',
                    streamId: '-'
                });
            }
        });
    }
}
