import {SkipLoading} from '../interceptors/loading.interceptor';
import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {BehaviorSubject} from 'rxjs';
import {MessageService} from './message.service';
import {NotificationService} from './notification.service';
import {SessionService} from './session.service';
import {User} from '../entities';

describe('Persistent inbox services', () => {
  let http: HttpTestingController;
  let session: BehaviorSubject<User | null>;
  beforeEach(() => {
    session = new BehaviorSubject<User | null>({uuid: 'alice'} as User);
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: SessionService, useValue: {getUser: () => session.asObservable()}}]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses separate inboxes and recipient-owned read endpoints', () => {
    const messages = TestBed.inject(MessageService);
    const notifications = TestBed.inject(NotificationService);
    messages.list(25).subscribe(page => expect(page.total).toBe(26));
    const request = http.expectOne('/api/messages?offset=25');
    expect(request.request.context.get(SkipLoading)).toBeFalse();
    request.flush({data: {items: [], total: 26, unread: 1}});
    notifications.list().subscribe();
    http.expectOne('/api/notifications?offset=0').flush({data: {items: [], total: 0, unread: 0}});
    messages.markRead('entry').subscribe();
    const read = http.expectOne('/api/messages/entry/read');
    expect(read.request.method).toBe('PATCH');
    read.flush({data: true});
    notifications.markAllRead().subscribe();
    http.expectOne('/api/notifications/read').flush({data: true});
  });

  it('skips loading only for explicitly background list requests', () => {
    for (const service of [TestBed.inject(MessageService), TestBed.inject(NotificationService)]) {
      for (const background of [false, true]) {
        service.list(0, background).subscribe();
        const request = http.expectOne(req => req.url.endsWith('/messages') || req.url.endsWith('/notifications'));
        expect(request.request.context.get(SkipLoading)).toBe(background);
        request.flush({data: {items: [], total: 0, unread: 0}});
      }
    }
  });

  it('refreshes unread counts after reading and clears them on logout', fakeAsync(() => {
    const service = TestBed.inject(NotificationService);
    const state = {unread: null as number | null};
    const subscription = service.counts$.subscribe(count => state.unread = count?.unread ?? null);
    tick(0);
    const counts = http.expectOne('/api/poll');
    expect(counts.request.context.get(SkipLoading)).toBeFalse();
    expect(counts.request.body.requests[0].resource).toBe('notifications-counts');
    counts.flush({results: [{id: counts.request.body.requests[0].id, status: 200, data: {unread: 2, total: 2}}]});
    expect(state.unread).toBe(2);
    service.markRead('entry').subscribe();
    http.expectOne('/api/notifications/entry/read').flush({data: true});
    tick(0);
    const afterRead = http.expectOne('/api/poll');
    expect(afterRead.request.context.get(SkipLoading)).toBeFalse();
    afterRead.flush({results: [{id: afterRead.request.body.requests[0].id, status: 200, data: {unread: 1, total: 2}}]});
    expect(state.unread).toBe(1);
    tick(15000);
    const pending = http.expectOne('/api/poll');
    expect(pending.request.context.get(SkipLoading)).toBeTrue();
    session.next(null);
    expect(pending.cancelled).toBeTrue();
    expect(state.unread).toBeNull();
    subscription.unsubscribe();
  }));
});
