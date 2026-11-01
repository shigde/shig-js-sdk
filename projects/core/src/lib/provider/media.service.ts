import {Injectable} from '@angular/core';
import {map, Observable} from 'rxjs';
import {MediaRecording, RecordedVideo} from '../entities';
import {VideoService} from './video.service';

/** Lobby recording controls. Each recording refers to its own persisted video. */
@Injectable({providedIn: 'root'})
export class MediaService {
  constructor(private videos: VideoService) {}

  getRecording(streamUuid: string): Observable<MediaRecording> {
    return this.videos.listForStream(streamUuid).pipe(map(videos => {
      const video = videos.find(item => item.status === 'recording') ?? videos[0];
      return video ? this.recording(video) : {streamUuid, status: 'empty', published: false, durationMs: 0};
    }));
  }
  startRecording(streamUuid: string): Observable<MediaRecording> {
    return this.videos.startRecording(streamUuid).pipe(map(video => this.recording(video)));
  }
  stopRecording(videoUuid: string): Observable<MediaRecording> {
    return this.videos.stopRecording(videoUuid).pipe(map(video => this.recording(video)));
  }
  setPublished(videoUuid: string, published: boolean): Observable<MediaRecording> {
    return this.videos.update(videoUuid, {published}).pipe(map(video => this.recording(video)));
  }
  private recording(video: RecordedVideo): MediaRecording {
    return {
      streamUuid: video.sourceStreamUuid, videoUuid: video.uuid,
      status: video.status === 'pending' ? 'empty' : video.status === 'processing' ? 'finalizing' : video.status,
      published: video.publishedAt !== null, durationMs: video.durationMs, error: video.error ?? undefined,
    };
  }
}
