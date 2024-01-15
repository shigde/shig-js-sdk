export enum LobbyMediaType {
    GUEST = 1,
    STREAM
}

export function getMediaStreamTypeByNumber(index: number): LobbyMediaType {
    switch (index) {
        case 1: {
            return LobbyMediaType.GUEST;
        }
        case 2: {
            return LobbyMediaType.STREAM;
        }
    }
    return LobbyMediaType.GUEST;
}


