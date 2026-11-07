/** Current lobby control state. Video metadata is represented by RecordedVideo. */
export interface MediaRecording {
  streamUuid: string;
  videoUuid?: string;
  startedAt?: string | null;
  status: 'empty' | 'recording' | 'finalizing' | 'ready' | 'failed';
  published: boolean;
  durationMs: number;
  error?: string;
}

