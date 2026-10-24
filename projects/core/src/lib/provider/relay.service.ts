import {Injectable} from "@angular/core";
import {HttpClient, HttpContext, HttpHeaders} from "@angular/common/http";
import {filter, map, Observable} from "rxjs";
import {ParameterService} from "./parameter.service";
import {PollingService} from './polling.service';
import {SkipLoading} from "../interceptors/loading.interceptor";

@Injectable({providedIn: 'root'})
export class RelayService {
  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'text/plain; charset=utf-8', 'Accept': 'application/text'}),
    context: new HttpContext().set(SkipLoading, true),
    responseType: 'text' as const,
  };

  constructor(private http: HttpClient, private params: ParameterService, private polling: PollingService) {
  }

  pollHasAnnouncement(channelUuid: string, streamUuid: string, intervalMs = 5000): Observable<boolean> {
    const url = `${this.params.API_PREFIX}/pub/streaming/announced/live/${channelUuid}`;
    return this.polling.watch({
      key: `relay:${url}`, intervalMs, batch: {resource: 'stream-status', channelUuid},
      load: context => this.http.get(url, {...this.httpOptions, context}),
    }).pipe(
      filter(state => !state.loading && !state.error && state.data !== null),
      map(state => state.data!.trim() === streamUuid)
    );
  }

  public hasAnnouncement(channelUuid: string, streamUuid: string): Observable<boolean> {
    const url = `${this.params.API_PREFIX}/pub/streaming/announced/live/${channelUuid}`;
    return this.http.get(url, this.httpOptions).pipe(
      map(announcedStreamId => announcedStreamId.trim() === streamUuid)
    );
  }
}
