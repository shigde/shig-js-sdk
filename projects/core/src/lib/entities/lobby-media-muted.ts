export enum LobbyMediaMuted {
    Muted = 1,
    NotMuted = 2
}

export function getLobbyMediaMuted(muted: boolean | undefined): LobbyMediaMuted {
    return (muted !== undefined && muted) ? LobbyMediaMuted.Muted : LobbyMediaMuted.NotMuted;
}

export function getMuted(media: string): boolean {
    return (media === '1');
}
