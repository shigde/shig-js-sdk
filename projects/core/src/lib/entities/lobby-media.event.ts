import {LobbyMedia} from './lobby-media';

export interface LobbyMediaEvent {
    type: 'add' | 'remove' | 'mute',
    media: LobbyMedia
    // add event
    track?: MediaStreamTrack,
    stream?: MediaStream,
}
