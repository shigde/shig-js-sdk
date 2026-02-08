import {Role} from "./role";

export interface StreamFriend {
  uuid: string,
  channel_uuid: string,
  name: string,
  domain: string,
  avatar: string,
  role: Role,
}
