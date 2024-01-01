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

export function buildGuest(name: string | undefined, stream: MediaStream): Guest {
    const id = !!name ? name : 'unknown';
    return new Guest({id, name: id} as User, stream);
}
