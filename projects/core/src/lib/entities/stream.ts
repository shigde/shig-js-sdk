import {Video} from './video';
import {Weekday} from './weekday';

// #[serde(rename_all = "camelCase")]
export interface Stream {
  uuid: string;
  title: string;
  thumbnail: string;
  description: string;
  support: string;
  date: Date; // mm:hh dd:MM:YYYY
  start_time: Date | null; // mm:hh dd:MM:YYYY
  end_time: Date | null; // mm:hh dd:MM:YYYY
  viewer: number;
  likes: number;
  dislikes: number;
  licence: StreamLicence;
  isRepeating: boolean;
  repeat: Weekday;
  metaData: StreamMetaData;
  isPublic: boolean;
  isLive: boolean;
  ownerUuid: string;
  channelUuid: string;
  participants?: string[]; // user's uuid
  video?: Video | null;
}

export interface StreamPreview {
  uuid: string;
  title: string;
  thumbnail: string;
  description: string;
  support: string;
  date: Date; // mm:hh dd:MM:YYYY
  start_time: Date | null; // mm:hh dd:MM:YYYY
  end_time: Date | null; // mm:hh dd:MM:YYYY
  viewer: number;
  likes: number;
  dislikes: number;
  isLive: boolean;
  ownerName: string;
  ownerUuid: string;
  ownerAvatar: string;
  channelName: string;
  channelUuid: string;
}

export enum StreamProtocol {
  RTMP = 1,
  WHIP,
  MOQ,
}

export enum StreamLatency {
  LOW = 1,
  STANDARD,
  HIGH,
}

export enum StreamLicence {
  DEFAULT = 1,
}

export interface StreamMetaData {
  isShig: boolean,
  streamKey: string,
  url: string,
  protocol: StreamProtocol,
  permanentLive: boolean,
  saveReplay: boolean,
  latencyMode: StreamLatency,
}
