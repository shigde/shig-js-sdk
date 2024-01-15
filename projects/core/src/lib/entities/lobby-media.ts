import {LobbyMediaType} from './lobby-media-type';

export type LobbyMediaIndex = string

export interface LobbyMedia {
    mediaIndex: LobbyMediaIndex;
    mediaType: LobbyMediaType;
    info: string;
    kind: 'audio' | 'video';
    muted: boolean;
    trackId: string;
    streamId: string;
}
