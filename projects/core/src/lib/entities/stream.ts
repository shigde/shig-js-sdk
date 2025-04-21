import {Video} from './video';
import {Weekday} from './weekday';

export interface Stream {
  uuid: string;
  title: string;
  thumbnail: string;
  description: string;
  support: string;
  date: Date; // mm:hh dd:MM:YYYY
  views: number;
  likes: number;
  dislikes: number;
  licence: number,
  repeat: Weekday | null;
  metaData: StreamMetaData;
  isPublic: boolean;
  isLive: boolean;
  ownerUuid: string;
  channelUuid: string;
  participants: string[]; // user's uuid
  video: Video | null;
}

export interface StreamMetaData {
  streamKey?: string
  rtmpUrl?: string | null
  rtmpsUrl?: string | null,
  permanentLive?: boolean,
  saveReplay?: boolean,
  latencyMode?: number
}
