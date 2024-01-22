import {LobbyMediaPurpose} from './lobby-media-purpose';

export interface SdpMediaInfo {
    purpose: LobbyMediaPurpose;
    muted: boolean;
    info: string;
}
