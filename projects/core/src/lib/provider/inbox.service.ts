import {SkipLoading} from '../interceptors/loading.interceptor';
import {HttpClient, HttpContext} from '@angular/common/http';
import {catchError, distinctUntilChanged, map, merge, Observable, of, shareReplay, Subject, startWith, switchMap, tap, timer} from 'rxjs';
import {ApiResponse, InboxCounts, InboxPage} from '../entities';
import {ParameterService} from './parameter.service';
import {SessionService} from './session.service';

/** Shared recipient-owned inbox transport; session changes cancel previous requests. */
export abstract class InboxService {
  private readonly backgroundOptions = {context: new HttpContext().set(SkipLoading, true)};
  private readonly changed = new Subject<void>();
  readonly counts$: Observable<InboxCounts | null>;
  protected constructor(private http: HttpClient, private params: ParameterService, session: SessionService, private kind: 'messages' | 'notifications') {
    this.counts$ = session.getUser().pipe(
      map(user => user?.uuid ?? null), distinctUntilChanged(),
      switchMap(uuid => uuid ? merge(timer(0, 15000).pipe(map(tick => tick > 0)), this.changed.pipe(map(() => false))).pipe(
        switchMap(background => this.http.get<ApiResponse<InboxCounts>>(`${this.url}/counts`, background ? this.backgroundOptions : {}).pipe(
          map(response => response.data), catchError(() => of(null))
        )), startWith(null)
      ) : of(null)),
      shareReplay({bufferSize: 1, refCount: true})
    );
  }
  private get url(): string { return `${this.params.API_PREFIX}/${this.kind}`; }
  list(offset = 0, background = false): Observable<InboxPage> {
    return this.http.get<ApiResponse<InboxPage>>(this.url, {...(background ? this.backgroundOptions : {}), params: {offset}}).pipe(map(response => response.data));
  }
  markRead(id: string): Observable<boolean> {
    return this.http.patch<ApiResponse<boolean>>(`${this.url}/${encodeURIComponent(id)}/read`, {}).pipe(map(response => response.data), tap(() => this.changed.next()));
  }
  markAllRead(): Observable<boolean> {
    return this.http.patch<ApiResponse<boolean>>(`${this.url}/read`, {}).pipe(map(response => response.data), tap(() => this.changed.next()));
  }
}
