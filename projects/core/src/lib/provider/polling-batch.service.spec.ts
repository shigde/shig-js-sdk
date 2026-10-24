import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {BehaviorSubject, throwError} from 'rxjs';
import {PollingService, PollResourceError, PollState} from './polling.service';
import {SessionService} from './session.service';
import {SkipLoading} from '../interceptors/loading.interceptor';
import {User} from '../entities';

describe('PollingService HTTP batches', () => {
  let polling: PollingService;
  let http: HttpTestingController;
  const fallback = () => throwError(() => new Error('Fallback must not run while authenticated'));
  beforeEach(() => {
    const user = new BehaviorSubject<User | null>({uuid: 'user'} as User);
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: SessionService, useValue: {getUser: () => user.asObservable()}}]});
    polling = TestBed.inject(PollingService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {polling.ngOnDestroy(); http.verify();});

  it('sends only due resources together and isolates individual error codes', fakeAsync(() => {
    const counts: {state: PollState<{unread: number}> | null} = {state: null};
    const monitor: {state: PollState<unknown> | null} = {state: null};
    const first = polling.watch<{unread: number}>({key: 'counts', intervalMs: 5000, requiresSession: true,
      batch: {resource: 'notifications-counts'}, load: fallback}).subscribe(state => counts.state = state);
    const second = polling.watch({key: 'monitor', intervalMs: 15000, requiresSession: true,
      batch: {resource: 'monitoring'}, load: fallback}).subscribe(state => monitor.state = state);
    tick(0);
    const initial = http.expectOne('/api/poll');
    expect(initial.request.method).toBe('POST');
    expect(initial.request.context.get(SkipLoading)).toBeFalse();
    expect(initial.request.body.requests.length).toBe(2);
    initial.flush({results: initial.request.body.requests.map((item: {id: string; resource: string}) =>
      item.resource === 'monitoring' ? {id: item.id, status: 403, error: {code: 'FORBIDDEN', message: 'Admin only'}} : {id: item.id, status: 200, data: {unread: 3}})});
    expect(counts.state?.data?.unread).toBe(3);
    expect(monitor.state?.error instanceof PollResourceError).toBeTrue();
    expect((monitor.state?.error as PollResourceError).code).toBe('FORBIDDEN');
    tick(5000);
    const automatic = http.expectOne('/api/poll');
    expect(automatic.request.context.get(SkipLoading)).toBeTrue();
    expect(automatic.request.body.requests.map((item: {resource: string}) => item.resource)).toEqual(['notifications-counts']);
    automatic.flush({results: [{id: automatic.request.body.requests[0].id, status: 200, data: {unread: 2}}]});
    polling.refresh('monitor'); tick(0);
    const manual = http.expectOne('/api/poll');
    expect(manual.request.context.get(SkipLoading)).toBeFalse();
    manual.flush({results: [{id: manual.request.body.requests[0].id, status: 200, data: {active_lobbies: 1}}]});
    expect(monitor.state?.error).toBeNull();
    first.unsubscribe(); second.unsubscribe(); tick(30000); http.expectNone('/api/poll');
  }));

  it('does not cancel a shared batch until all its recipients unsubscribe', fakeAsync(() => {
    const first = polling.watch({key: 'messages', intervalMs: 15000, batch: {resource: 'messages-counts'}, load: fallback}).subscribe();
    const second = polling.watch({key: 'notifications', intervalMs: 15000, batch: {resource: 'notifications-counts'}, load: fallback}).subscribe();
    tick(0);
    const request = http.expectOne('/api/poll');
    first.unsubscribe(); expect(request.cancelled).toBeFalse();
    second.unsubscribe(); expect(request.cancelled).toBeTrue();
    tick(30000); http.expectNone('/api/poll');
  }));

  it('reports a missing resource response without discarding another result', fakeAsync(() => {
    const errors: unknown[] = [];
    polling.watch({key: 'first', intervalMs: 15000, batch: {resource: 'messages-counts'}, load: fallback}).subscribe(state => {if (state.error) errors.push(state.error);});
    let secondValue: unknown;
    polling.watch({key: 'second', intervalMs: 15000, batch: {resource: 'notifications-counts'}, load: fallback}).subscribe(state => secondValue = state.data);
    tick(0);
    const request = http.expectOne('/api/poll');
    request.flush({results: [{id: request.request.body.requests[1].id, status: 200, data: 42}]});
    expect((errors[0] as PollResourceError).code).toBe('INVALID_RESPONSE');
    expect(secondValue).toBe(42);
    polling.ngOnDestroy();
  }));
});
