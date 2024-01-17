import {LobbyMediaPurpose} from './lobby-media-purpose';

export type LobbyMediaIndex = number

export interface LobbyMedia {
    mediaIndex: LobbyMediaIndex;
    purpose: LobbyMediaPurpose;
    info: string;
    kind: 'audio' | 'video';
    muted: boolean;
    trackId: string;
    streamId: string;
}
