import {Injectable} from '@angular/core';
import {HttpClient, HttpContext} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {ApiResponse} from '../entities';
import {MediaRecording} from '../entities/media-recording';
import {ParameterService} from './parameter.service';
import {SkipLoading} from '../interceptors/loading.interceptor';

/** Recording controls for the current server API. Archive integration is pending. */
@Injectable({providedIn: 'root'})
export class MediaService {
  constructor(private http: HttpClient, private params: ParameterService) {}

  getRecording(streamUuid: string): Observable<MediaRecording> {
    return this.http.get<ApiResponse<MediaRecording>>(this.url(streamUuid), {
      context: new HttpContext().set(SkipLoading, true),
    }).pipe(map(response => response.data));
  }

  startRecording(streamUuid: string): Observable<MediaRecording> {
    return this.http.post<ApiResponse<MediaRecording>>(this.url(streamUuid), {})
      .pipe(map(response => response.data));
  }

  stopRecording(streamUuid: string): Observable<MediaRecording> {
    return this.http.delete<ApiResponse<MediaRecording>>(this.url(streamUuid))
      .pipe(map(response => response.data));
  }

  setPublished(streamUuid: string, published: boolean): Observable<MediaRecording> {
    return this.http.put<ApiResponse<MediaRecording>>(`${this.url(streamUuid)}/publication`, {published})
      .pipe(map(response => response.data));
  }

  private url(streamUuid: string): string {
    return `${this.params.API_PREFIX}/stream/${encodeURIComponent(streamUuid)}/recording`;
  }
}
