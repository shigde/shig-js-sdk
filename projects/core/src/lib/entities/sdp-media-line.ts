import {LobbyMediaPurpose} from './lobby-media-purpose';

export interface SdpMediaLine {
    mid: number;
    trackId: string;
    streamId: string
    kind: 'audio' | 'video';
    direction: 'sendrecv' | 'recvonly' | 'sendonly' | 'inactive';
    muted: boolean;
    purpose: LobbyMediaPurpose;
    info: string;
    ssrcs: number[];
}
