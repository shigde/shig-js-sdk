import {LobbyMediaType} from './lobby-media-type';

export interface SdpMediaLine {
    mid: number;
    msid: string;
    kind: 'audio' | 'video';
    mediaType: LobbyMediaType;
    direction: 'sendrecv' | 'recvonly' | 'sendonly' | 'inactive';
    info: string;
}
