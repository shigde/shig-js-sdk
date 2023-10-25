export interface StreamLiveData {
    streamKey?: string
    rtmpUrl?: string | null
    rtmpsUrl?: string | null,
    permanentLive?: boolean,
    saveReplay?: boolean,
    latencyMode?: number
}
