import {Injectable} from '@angular/core';
import {HttpClient, HttpContext} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {ApiResponse, RecordedVideo, RecordedVideoUpdate, RecordedVideoPreview} from '../entities';
import {ParameterService} from './parameter.service';
import {SkipLoading} from '../interceptors/loading.interceptor';

@Injectable({providedIn: 'root'})
export class VideoService {
  constructor(private http: HttpClient, private params: ParameterService) {}

  getPreview(uuid: string): Observable<RecordedVideoPreview> {
    return this.http.get<ApiResponse<RecordedVideoPreview>>(
      `${this.params.API_PREFIX}/pub/recorded-video-preview/${encodeURIComponent(uuid)}`,
    ).pipe(map(response => this.preview(response.data)));
  }
  getPreviewList(): Observable<RecordedVideoPreview[]> {
    return this.http.get<ApiResponse<RecordedVideoPreview[]>>(`${this.params.API_PREFIX}/pub/recorded-video-preview`)
      .pipe(map(response => response.data.map(item => this.preview(item))));
  }
  getChannelPreviewList(channelUuid: string): Observable<RecordedVideoPreview[]> {
    return this.http.get<ApiResponse<RecordedVideoPreview[]>>(
      `${this.params.API_PREFIX}/pub/channel/${encodeURIComponent(channelUuid)}/recorded-video-preview`,
    ).pipe(map(response => response.data.map(item => this.preview(item))));
  }

  list(): Observable<RecordedVideo[]> {
    return this.http.get<ApiResponse<RecordedVideo[]>>(`${this.params.API_PREFIX}/videos`)
      .pipe(map(response => response.data));
  }

  listForStream(streamUuid: string): Observable<RecordedVideo[]> {
    return this.http.get<ApiResponse<RecordedVideo[]>>(`${this.streamUrl(streamUuid)}/videos`, {
      context: new HttpContext().set(SkipLoading, true),
    }).pipe(map(response => response.data));
  }
  /** Create an unpublished metadata snapshot without starting a recorder. */
  createFromStream(streamUuid: string): Observable<RecordedVideo> {
    return this.http.post<ApiResponse<RecordedVideo>>(`${this.streamUrl(streamUuid)}/videos`, {})
      .pipe(map(response => response.data));
  }
  get(uuid: string): Observable<RecordedVideo> {
    return this.http.get<ApiResponse<RecordedVideo>>(this.videoUrl(uuid)).pipe(map(response => response.data));
  }
  update(uuid: string, changes: RecordedVideoUpdate): Observable<RecordedVideo> {
    return this.http.patch<ApiResponse<RecordedVideo>>(this.videoUrl(uuid), changes).pipe(map(response => response.data));
  }
  delete(uuid: string): Observable<void> {
    return this.http.delete<void>(this.videoUrl(uuid));
  }
  startRecording(streamUuid: string): Observable<RecordedVideo> {
    return this.http.post<ApiResponse<RecordedVideo>>(`${this.streamUrl(streamUuid)}/recordings`, {})
      .pipe(map(response => response.data));
  }
  waitForRecordingReady(streamUuid: string): Observable<void> {
    return this.http.get<void>(`${this.streamUrl(streamUuid)}/recordings/ready`, {
      context: new HttpContext().set(SkipLoading, true),
    });
  }
  stopRecording(uuid: string): Observable<RecordedVideo> {
    return this.http.post<ApiResponse<RecordedVideo>>(`${this.videoUrl(uuid)}/stop`, {})
      .pipe(map(response => response.data));
  }
  private streamUrl(uuid: string): string { return `${this.params.API_PREFIX}/streams/${encodeURIComponent(uuid)}`; }
  private preview(item: RecordedVideoPreview): RecordedVideoPreview {
    const date = (value: Date | string | null): Date | null =>
      typeof value === 'string' ? new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`) : value;
    return {...item, date: date(item.date)!, startTime: date(item.startTime), endTime: date(item.endTime)};
  }
  private videoUrl(uuid: string): string { return `${this.params.API_PREFIX}/videos/${encodeURIComponent(uuid)}`; }
}
