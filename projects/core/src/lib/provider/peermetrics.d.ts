declare module '@peermetrics/webrtc-stats' {
  export class WebRTCStats {
    constructor(options: {getStatsInterval: number; remote: boolean; rawStats: boolean; wrapGetUserMedia: boolean; wrapGetDisplayMedia: boolean});
    on(event: 'stats', listener: (event: Record<string, any>) => void): this;
    addConnection(options: {pc: RTCPeerConnection; peerId: string; connectionId: string}): Promise<{connectionId: string}>;
    removeConnection(options: {connectionId: string}): void;
    clearTimeline(): void;
    destroy(): void;
  }
}
