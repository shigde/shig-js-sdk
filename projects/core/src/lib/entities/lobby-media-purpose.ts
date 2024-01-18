export enum LobbyMediaPurpose {
    GUEST = 1,
    STREAM
}

export function getMediaStreamTypeByNumber(index: number): LobbyMediaPurpose {
    switch (index) {
        case 1: {
            return LobbyMediaPurpose.GUEST;
        }
        case 2: {
            return LobbyMediaPurpose.STREAM;
        }
    }
    return LobbyMediaPurpose.GUEST;
}


