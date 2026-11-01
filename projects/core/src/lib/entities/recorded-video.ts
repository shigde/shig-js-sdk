/** Local video created from a recording. Separate from the PeerTube Video response. */
export interface RecordedVideo {
  uuid: string;
  type: 'video';
  sourceStreamUuid: string;
  ownerUuid: string;
  channelUuid: string;
  title: string;
  description: string;
  support: string;
  thumbnail: string;
  licence: number;
  isPublic: boolean;
  publishedAt: string | null;
  status: 'pending' | 'recording' | 'processing' | 'ready' | 'failed';
  durationMs: number;
  error: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RecordedVideoUpdate = Partial<Pick<RecordedVideo,
  'title' | 'description' | 'support' | 'thumbnail' | 'licence' | 'isPublic'>> & {published?: boolean};
export type ContentType = 'stream' | 'video';

/** Public, ready, published recorded video in preview lists. */
export interface RecordedVideoPreview {
  uuid: string;
  type: 'video';
  sourceStreamUuid: string;
  title: string;
  thumbnail: string;
  description: string;
  support: string;
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
  durationMs: number;
  viewer: number;
  likes: number;
  dislikes: number;
  isLive: false;
  isPublic: true;
  ownerName: string;
  ownerUuid: string;
  ownerAvatar: string;
  channelName: string;
  channelUuid: string;
  channelDisplayName: string;
}
