import {SkipLoading} from '../interceptors/loading.interceptor';
import {HttpClient, HttpContext} from '@angular/common/http';
import {distinctUntilChanged, map, Observable, of, shareReplay, startWith, switchMap, tap} from 'rxjs';
import {ApiResponse, InboxCounts, InboxPage} from '../entities';
import {ParameterService} from './parameter.service';
import {PollingService} from './polling.service';
import {SessionService} from './session.service';

/** Shared recipient-owned inbox transport; session changes cancel previous requests. */
export abstract class InboxService {
  private readonly backgroundOptions = {context: new HttpContext().set(SkipLoading, true)};
  readonly counts$: Observable<InboxCounts | null>;
  protected constructor(private http: HttpClient, private params: ParameterService, session: SessionService, private kind: 'messages' | 'notifications', private polling: PollingService) {
    this.counts$ = session.getUser().pipe(
      map(user => user?.uuid ?? null), distinctUntilChanged(),
      switchMap(uuid => uuid ? this.polling.watch<InboxCounts>({
        key: this.countsKey, intervalMs: 15000, requiresSession: true, batch: {resource: this.kind === 'messages' ? 'messages-counts' : 'notifications-counts'},
        load: context => this.http.get<ApiResponse<InboxCounts>>(`${this.url}/counts`, {context}).pipe(map(response => response.data)),
      }).pipe(map(state => state.data), distinctUntilChanged(), startWith(null)) : of(null)),
      shareReplay({bufferSize: 1, refCount: true})
    );
  }
  private get url(): string { return `${this.params.API_PREFIX}/${this.kind}`; }
  private get countsKey(): string { return `inbox-counts:${this.url}`; }
  list(offset = 0, background = false): Observable<InboxPage> {
    return this.http.get<ApiResponse<InboxPage>>(this.url, {...(background ? this.backgroundOptions : {}), params: {offset}}).pipe(map(response => response.data));
  }
  markRead(id: string): Observable<boolean> {
    return this.http.patch<ApiResponse<boolean>>(`${this.url}/${encodeURIComponent(id)}/read`, {}).pipe(map(response => response.data), tap(() => this.polling.refresh(this.countsKey)));
  }
  markAllRead(): Observable<boolean> {
    return this.http.patch<ApiResponse<boolean>>(`${this.url}/read`, {}).pipe(map(response => response.data), tap(() => this.polling.refresh(this.countsKey)));
  }
}
