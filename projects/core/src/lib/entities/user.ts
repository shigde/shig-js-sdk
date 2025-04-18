import {Role} from './role';

export interface User {
    uuid: string,
    channel_uuid: string,
    name: string,
    domain: string,
    avatar: string,
    role: Role,
}
