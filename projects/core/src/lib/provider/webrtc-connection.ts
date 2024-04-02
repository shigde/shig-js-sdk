import {EventEmitter} from '@angular/core';
import {
    ChannelMsg,
    ChannelMsgType,
    LobbyMedia,
    LobbyMediaEvent,
    LobbyMediaIndex,
    LobbyMediaPurpose,
    SdpMediaInfo
} from '../entities';
import {SdpParser} from './sdp-parser';

export class WebrtcConnection extends EventEmitter<LobbyMediaEvent> {
    private readonly pc: RTCPeerConnection;
    private readonly remoteMedia: Map<LobbyMediaIndex, LobbyMedia> = new Map<LobbyMediaIndex, LobbyMedia>();
    private dataChannel: RTCDataChannel | undefined;

    constructor(
        private readonly config: RTCConfiguration,
        private readonly type: 'ingress' | 'egress'
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

    public createOffer(streams: Map<LobbyMediaPurpose, MediaStream>, info: string): Promise<RTCSessionDescription> {
        const trackInfo = new Map<string, SdpMediaInfo>();
        streams.forEach((ms, streamType) => {
            let streamId = ms.id;
            ms.getTracks().forEach((track) => {
                this.pc.addTrack(track, ms);
                trackInfo.set(`${streamId} ${track.id}`.trim(), {
                    purpose: streamType,
                    muted: !track.enabled,
                    info: info
                });
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
        this.beforeRemoteOffer(offer);
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
            console.log('error! an transceiver without a media should not exits', ev.transceiver.mid, this.remoteMedia);
        }
    }

    private onSignalStateChange() {
        console.log(`signal state: ${this.pc.signalingState}`);
        this.logTransceiversState(this.pc.signalingState)
        if (this.pc.signalingState === 'have-remote-offer') {
            this.onRemoteOffer(this.pc.remoteDescription);
        }
    }

    private beforeRemoteOffer(sdp: RTCSessionDescription): void {
        const mediaLines = SdpParser.getSdpMediaLine(sdp);
        mediaLines.forEach((line) => {
            const media = this.remoteMedia.get(line.mid);
            const updateMedia: LobbyMedia = {
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
        console.log('####---', this.type);
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
            console.log(`### TS:
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
