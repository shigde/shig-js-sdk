/** Current recording-control response, not the future standalone video entity. */
export interface MediaRecording {
  streamUuid: string;
  status: 'empty' | 'recording' | 'finalizing' | 'ready' | 'failed';
  published: boolean;
  durationMs: number;
  error?: string;
}

