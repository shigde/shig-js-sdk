import {ParameterService} from './parameter.service';
import {DOCUMENT} from '@angular/common';
import {HttpClient, HttpContext} from '@angular/common/http';
import {Inject, Injectable, Injector, OnDestroy} from '@angular/core';
import {BehaviorSubject, distinctUntilChanged, map, Observable, shareReplay, Subscription} from 'rxjs';
import {SkipLoading} from '../interceptors/loading.interceptor';
import {SessionService} from './session.service';

export type PollResource =
  | {resource: 'messages-counts' | 'notifications-counts' | 'monitoring'}
  | {resource: 'messages' | 'notifications'; offset: number}
  | {resource: 'stream-status'; channelUuid: string}
  | {resource: 'host-presence'; channelUuid: string; streamUuid: string};
interface BatchResponse { results: {id: string; status: number; data?: unknown; error?: {code: string; message: string}}[]; }
export class PollResourceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = 'PollResourceError'; }
}

export interface PollState<T> {
  data: T | null;
  loading: boolean;
  error: unknown | null;
  updatedAt: number | null;
}
export interface PollRequest<T> {
  /** Include resource parameters in the key; a key always describes the same response type. */
  key: string;
  intervalMs: number;
  load: (context: HttpContext) => Observable<T>;
  requiresSession?: boolean;
  /** Known resources use /api/poll when authenticated; load remains the anonymous/custom fallback. */
  batch?: PollResource;
}
interface Entry {
  key: string;
  consumers: Map<symbol, PollRequest<unknown>>;
  state: BehaviorSubject<PollState<unknown>>;
  flight?: Subscription;
  attempts: number;
  failures: number;
  due: number;
  manual: boolean;
}

/** One scheduler for explicitly subscribed resources. It never discovers or preloads page data. */
@Injectable({providedIn: 'root'})
export class PollingService implements OnDestroy {
  private readonly entries = new Map<string, Entry>();
  private scheduler?: ReturnType<typeof setTimeout>;
  private sessionSubscription?: Subscription;
  private user: string | null = null;
  private listening = false;
  private readonly visibilityChanged = () => {
    if (this.document.hidden) {
      this.stopScheduler();
      for (const entry of this.entries.values()) {
        entry.flight?.unsubscribe(); entry.flight = undefined;
        entry.state.next({...entry.state.value, loading: false});
      }
    } else {
      for (const entry of this.entries.values()) entry.due = 0;
      this.schedule();
    }
  };

  constructor(@Inject(DOCUMENT) private document: Document, private session: SessionService, private injector: Injector) {}

  watch<T>(request: PollRequest<T>): Observable<PollState<T>> {
    return new Observable(subscriber => {
      if (!request.key || !Number.isFinite(request.intervalMs) || request.intervalMs < 1000) {
        subscriber.error(new Error('Polling requires a key and an interval of at least 1000 ms'));
        return;
      }
      this.listen();
      let entry = this.entries.get(request.key);
      if (!entry) {
        entry = {key: request.key, consumers: new Map(), state: new BehaviorSubject<PollState<unknown>>({data: null, loading: false, error: null, updatedAt: null}), attempts: 0, failures: 0, due: 0, manual: false};
        this.entries.set(request.key, entry);
      }
      const id = Symbol();
      entry.consumers.set(id, request as PollRequest<unknown>);
      // A faster new consumer must not wait for an old, slower deadline.
      if (entry.state.value.updatedAt !== null) entry.due = Math.min(entry.due, entry.state.value.updatedAt + this.interval(entry));
      const subscription = entry.state.subscribe({
        next: state => subscriber.next(state as PollState<T>),
        complete: () => subscriber.complete(),
      });
      this.stopScheduler(); this.schedule();
      return () => {
        subscription.unsubscribe();
        entry!.consumers.delete(id);
        if (!entry!.consumers.size) {
          entry!.flight?.unsubscribe();
          entry!.state.complete();
          this.entries.delete(request.key);
        }
        if (!this.entries.size) this.unlisten();
      };
    });
  }

  /** User-triggered refresh: normal loader; queue once if the resource is already in flight. */
  refresh(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.manual = true; entry.due = 0;
    this.stopScheduler(); this.schedule();
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    this.document.addEventListener('visibilitychange', this.visibilityChanged);
    this.sessionSubscription = this.session.getUser().pipe(map(user => user?.uuid ?? null), distinctUntilChanged()).subscribe(user => {
      this.user = user;
      for (const entry of this.entries.values()) {
        entry.flight?.unsubscribe(); entry.flight = undefined;
        entry.attempts = 0; entry.failures = 0; entry.due = 0; entry.manual = false;
        entry.state.next({data: null, loading: false, error: null, updatedAt: null});
      }
      this.stopScheduler(); this.schedule();
    });
  }
  private unlisten(): void {
    this.stopScheduler();
    this.sessionSubscription?.unsubscribe(); this.sessionSubscription = undefined;
    this.document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.listening = false;
  }
  private interval(entry: Entry): number {
    return Math.min(...Array.from(entry.consumers.values(), request => request.intervalMs));
  }
  private allowed(entry: Entry): boolean {
    return !this.document.hidden && Array.from(entry.consumers.values()).some(request => !request.requiresSession || !!this.user);
  }
  private schedule(): void {
    if (this.scheduler !== undefined || !this.entries.size || this.document.hidden) return;
    const due = Array.from(this.entries.values()).filter(entry => this.allowed(entry) && !entry.flight).map(entry => entry.due);
    if (!due.length) return;
    this.scheduler = setTimeout(() => {
      this.scheduler = undefined;
      const due = Array.from(this.entries.values()).filter(entry => this.allowed(entry) && !entry.flight && entry.due <= Date.now());
      const batched = due.filter(entry => !!this.user && !!this.request(entry).batch);
      for (let offset = 0; offset < batched.length; offset += 32) this.runBatch(batched.slice(offset, offset + 32));
      for (const entry of due) if (!batched.includes(entry)) this.run(entry);
      this.schedule();
    }, Math.max(0, Math.min(...due) - Date.now()));
  }
  private stopScheduler(): void {
    if (this.scheduler !== undefined) clearTimeout(this.scheduler);
    this.scheduler = undefined;
  }
  private request(entry: Entry): PollRequest<unknown> {
    return Array.from(entry.consumers.values()).find(request => !request.requiresSession || !!this.user)!;
  }
  private runBatch(entries: Entry[]): void {
    const requests = entries.map((entry, index) => ({id: `r${index}`, ...this.request(entry).batch!}));
    const background = entries.every(entry => !entry.manual && entry.attempts > 0);
    const http = this.injector.get(HttpClient);
    const prefix = this.injector.get(ParameterService).API_PREFIX;
    const response = http.post<BatchResponse>(`${prefix}/poll`, {requests}, {
      context: new HttpContext().set(SkipLoading, background),
    }).pipe(shareReplay({bufferSize: 1, refCount: true}));
    entries.forEach((entry, index) => this.run(entry, () => response.pipe(map(batch => {
      if (!Array.isArray(batch?.results)) throw new PollResourceError(502, 'INVALID_RESPONSE', 'Invalid batch response');
      const results = batch.results.filter(result => result.id === requests[index].id);
      if (results.length !== 1) throw new PollResourceError(502, 'INVALID_RESPONSE', 'Missing or duplicate resource response');
      const result = results[0];
      if (result.status !== 200) throw new PollResourceError(result.status, result.error?.code ?? 'RESOURCE_ERROR', result.error?.message ?? 'Resource failed');
      if (!Object.prototype.hasOwnProperty.call(result, 'data')) throw new PollResourceError(502, 'INVALID_RESPONSE', 'Missing resource data');
      return result.data;
    }))));
  }
  private run(entry: Entry, load?: (context: HttpContext) => Observable<unknown>): void {
    const request = this.request(entry);
    const background = !entry.manual && entry.attempts > 0;
    entry.manual = false; entry.attempts++;
    const flight = new Subscription(); entry.flight = flight;
    entry.state.next({...entry.state.value, loading: true, error: null});
    const finish = () => {
      if (entry.flight !== flight) return;
      entry.flight = undefined;
      entry.due = entry.manual ? 0 : Date.now() + this.interval(entry) * 2 ** Math.min(entry.failures, 3);
      entry.state.next({...entry.state.value, loading: false});
      this.stopScheduler(); this.schedule();
    };
    // Defer loader choice to the existing interceptor through its established context flag.
    try {
      flight.add((load ?? request.load)(new HttpContext().set(SkipLoading, background)).subscribe({
        next: data => { entry.failures = 0; entry.state.next({data, loading: true, error: null, updatedAt: Date.now()}); },
        error: error => { entry.failures++; entry.state.next({...entry.state.value, error}); finish(); },
        complete: finish
      }));
    } catch (error) {
      entry.failures++; entry.state.next({...entry.state.value, error}); finish();
    }
  }
  ngOnDestroy(): void {
    this.unlisten();
    for (const entry of this.entries.values()) { entry.flight?.unsubscribe(); entry.state.complete(); }
    this.entries.clear();
  }
}
