import {User} from './user';
import {LobbyMedia} from './lobby-media';
import {LobbyMediaPurpose} from './lobby-media-purpose';

export class LobbyMediaStream {
    public readonly streamId;
    public readonly purpose: LobbyMediaPurpose;
    public name: string;
    public stream: MediaStream | undefined;

    constructor(media: LobbyMedia) {
        this.streamId = media.streamId;
        this.purpose = media.purpose;
        this.name = media.info;
    }

    public static build(media: LobbyMedia, stream?: MediaStream | undefined): LobbyMediaStream {
        const mediaStream = new LobbyMediaStream(media);
        if (stream !== undefined) {
            mediaStream.setStream(stream);
        }
        return mediaStream;
    }

    public static buildLocal(name: string, stream: MediaStream): LobbyMediaStream {
        const mediaStream = new LobbyMediaStream({
            info: name,
            purpose: LobbyMediaPurpose.GUEST,
            streamId: 'local'
        } as LobbyMedia);
        mediaStream.setStream(stream);
        return mediaStream;
    }

    public setStream(stream: MediaStream) {
        this.stream = stream;
    }

    public stopStream() {
        this.stream?.getTracks().forEach(t => t.stop());
    }
}

