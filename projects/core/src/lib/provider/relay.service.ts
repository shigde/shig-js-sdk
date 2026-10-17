import {Injectable} from "@angular/core";
import {HttpClient, HttpContext, HttpHeaders} from "@angular/common/http";
import {catchError, EMPTY, finalize, map, Observable, shareReplay, switchMap, timer} from "rxjs";
import {ParameterService} from "./parameter.service";
import {SkipLoading} from "../interceptors/loading.interceptor";

@Injectable({providedIn: 'root'})
export class RelayService {
  private readonly announcementPolls = new Map<string, Observable<string>>();
  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'text/plain; charset=utf-8', 'Accept': 'application/text'}),
    context: new HttpContext().set(SkipLoading, true),
    responseType: 'text' as const,
  };

  constructor(private http: HttpClient, private params: ParameterService) {
  }

  pollHasAnnouncement(channelUuid: string, streamUuid: string, intervalMs = 5000): Observable<boolean> {
    const key = `${this.params.API_PREFIX}/${channelUuid}/${intervalMs}`;
    let poll = this.announcementPolls.get(key);
    if (!poll) {
      const url = `${this.params.API_PREFIX}/pub/streaming/announced/live/${channelUuid}`;
      poll = timer(0, intervalMs).pipe(
        switchMap(() => this.http.get(url, this.httpOptions).pipe(catchError(() => EMPTY))),
        finalize(() => this.announcementPolls.delete(key)),
        shareReplay({bufferSize: 1, refCount: true}),
      );
      this.announcementPolls.set(key, poll);
    }
    return poll.pipe(map(announcedStreamId => announcedStreamId.trim() === streamUuid));
  }

  public hasAnnouncement(channelUuid: string, streamUuid: string): Observable<boolean> {
    const url = `${this.params.API_PREFIX}/pub/streaming/announced/live/${channelUuid}`;
    return this.http.get(url, this.httpOptions).pipe(
      map(announcedStreamId => announcedStreamId.trim() === streamUuid)
    );
  }
}
