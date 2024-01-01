import {User} from './user';

export class Guest {
    constructor(
        public user: User,
        public stream: MediaStream
    ) {
    }

    public stopStream() {
        this.stream.getTracks().forEach(t => t.stop());
    }
}

export function buildGuest(id: string, name: string | undefined, stream: MediaStream): Guest {
    const username = !!name ? name : 'unknown';
    return new Guest({id, name: username} as User, stream);
}
