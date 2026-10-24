import {DOCUMENT} from '@angular/common';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {BehaviorSubject, of, Subject, throwError} from 'rxjs';
import {PollingService} from './polling.service';
import {SessionService} from './session.service';
import {SkipLoading} from '../interceptors/loading.interceptor';
import {User} from '../entities';

describe('PollingService demand scheduler', () => {
  let service: PollingService;
  let user: BehaviorSubject<User | null>;
  let hidden: boolean;
  let document: Document;
  beforeEach(() => {
    hidden = false;
    user = new BehaviorSubject<User | null>({uuid: 'alice'} as User);
    document = Object.assign(new EventTarget(), {get hidden() { return hidden; }}) as unknown as Document;
    // Object.assign evaluates accessors; install a dynamic visibility getter instead.
    Object.defineProperty(document, 'hidden', {get: () => hidden});
    TestBed.configureTestingModule({providers: [
      {provide: DOCUMENT, useValue: document},
      {provide: SessionService, useValue: {getUser: () => user.asObservable()}}
    ]});
    service = TestBed.inject(PollingService);
  });
  afterEach(() => service.ngOnDestroy());

  it('only polls subscribed resources, sharing a key and stopping at the last unsubscribe', fakeAsync(() => {
    const load = jasmine.createSpy('load').and.returnValue(of('live'));
    const request = {key: 'stream:a', intervalMs: 5000, load};
    const unused = service.watch<string>({key: 'unused', intervalMs: 5000, load});
    expect(unused).toBeDefined();
    tick(10000); expect(load).not.toHaveBeenCalled();
    const first = service.watch(request).subscribe();
    const second = service.watch({...request, intervalMs: 15000}).subscribe();
    tick(0); expect(load).toHaveBeenCalledTimes(1);
    expect(load.calls.argsFor(0)[0].get(SkipLoading)).toBeFalse();
    tick(5000); expect(load).toHaveBeenCalledTimes(2);
    expect(load.calls.argsFor(1)[0].get(SkipLoading)).toBeTrue();
    first.unsubscribe(); second.unsubscribe();
    tick(30000); expect(load).toHaveBeenCalledTimes(2);
  }));

  it('does not overlap requests and queues a manual refresh with the normal loader', fakeAsync(() => {
    const pending = new Subject<string>();
    const load = jasmine.createSpy('load').and.returnValues(pending, of('new'));
    service.watch<string>({key: 'inbox', intervalMs: 5000, load}).subscribe();
    tick(0); tick(15000); expect(load).toHaveBeenCalledTimes(1);
    service.refresh('inbox'); tick(0); expect(load).toHaveBeenCalledTimes(1);
    pending.next('old'); pending.complete(); tick(0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.calls.argsFor(1)[0].get(SkipLoading)).toBeFalse();
  }));

  it('pauses hidden tabs and cancels private requests and cached data on logout', fakeAsync(() => {
    const pending = new Subject<string>();
    const state = {data: null as string | null};
    const load = jasmine.createSpy('load').and.returnValues(of('private'), pending, of('after resume'));
    service.watch<string>({key: 'counts', intervalMs: 5000, requiresSession: true, load}).subscribe(value => state.data = value.data);
    tick(0); expect(state.data).toBe('private');
    tick(5000); expect(pending.observed).toBeTrue();
    user.next(null); expect(pending.observed).toBeFalse(); expect(state.data).toBeNull();
    tick(10000); expect(load).toHaveBeenCalledTimes(2);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    user.next({uuid: 'bob'} as User); tick(10000); expect(load).toHaveBeenCalledTimes(2);
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); tick(0);
    expect(state.data).toBe('after resume');
    expect(load.calls.argsFor(2)[0].get(SkipLoading)).toBeFalse();
  }));

  it('retains successful data on failure and increases the retry interval', fakeAsync(() => {
    const load = jasmine.createSpy('load').and.returnValues(of('last good'), throwError(() => new Error('offline')), of('recovered'));
    const state = {data: null as string | null, error: null as unknown};
    service.watch<string>({key: 'status', intervalMs: 5000, load}).subscribe(value => {state.data = value.data; state.error = value.error;});
    tick(0); tick(5000);
    expect(state.data).toBe('last good'); expect(state.error).toBeTruthy();
    tick(5000); expect(load).toHaveBeenCalledTimes(2);
    tick(5000); expect(state.data).toBe('recovered'); expect(state.error).toBeNull();
  }));
});
