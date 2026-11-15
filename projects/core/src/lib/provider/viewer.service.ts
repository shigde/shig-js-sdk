import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {ApiResponse} from '../entities';
import {ParameterService} from './parameter.service';
import {PollingService} from './polling.service';

export interface PublicStreamStatus { viewers: number; isLive: boolean; }

@Injectable({providedIn: 'root'})
export class ViewerService {
  constructor(private http: HttpClient, private params: ParameterService, private polling: PollingService) {}

  watchPublicStream(uuid: string): Observable<PublicStreamStatus> {
    const viewerId = crypto.randomUUID();
    return this.polling.watch<PublicStreamStatus>({
      key: `public-stream-viewer:${uuid}:${viewerId}`,
      intervalMs: 10000,
      load: context => this.http.post<ApiResponse<PublicStreamStatus>>(
        `${this.params.API_PREFIX}/pub/stream-viewers/${encodeURIComponent(uuid)}`,
        {viewerId},
        {context},
      ).pipe(map(response => response.data)),
    }).pipe(map(state => state.data ?? {viewers: 0, isLive: false}));
  }
}
