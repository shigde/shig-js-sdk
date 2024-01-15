import {LobbyMedia} from './lobby-media';

export interface LobbyMediaEvent {
    type: 'add' | 'remove',
    media: LobbyMedia
    // add event
    track?: MediaStreamTrack,
    stream?: MediaStream,
}
