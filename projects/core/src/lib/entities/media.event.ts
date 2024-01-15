export interface MediaEvent {
    mediaIndex: number
    type: 'add' | 'remove',
    track: MediaStreamTrack,
    stream?: MediaStream,
    parent?: RTCTrackEvent
}
