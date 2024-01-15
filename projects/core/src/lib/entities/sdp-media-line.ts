import {LobbyMediaType} from './lobby-media-type';

export interface SdpMediaLine {
    mid: string;
    msid: string;
    kind: 'audio' | 'video';
    mediaType: LobbyMediaType;
    direction: 'sendrecv' | 'recvonly' | 'sendonly' | 'inactive';
    info: string;
}
