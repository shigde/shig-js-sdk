import {Video} from './video';
import {Weekday} from './weekday';

export interface Stream {
    uuid: string;
    titel: string;
    thumbnail: string
    description: string;
    support: string;
    date: Date; // mm:hh dd:MM:YYYY
    repeat: Weekday | null;
    metaData: StreamMetaData;
    isPublic: boolean;
    isLive: boolean;
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
