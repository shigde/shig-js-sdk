import {HTTP_INTERCEPTORS, HttpClient, HttpContext, provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {AuthInterceptor} from './auth.interceptor';
import {SkipLoading} from './loading.interceptor';
import {SessionService} from '../provider/session.service';

describe('Token refresh for coordinated polling', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  beforeEach(() => {
    let token = 'old';
    TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting(),
      {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true},
      {provide: SessionService, useValue: {getAuthenticationToken: () => token, getRefreshToken: () => 'refresh',
        setToken: (value: {jwt: string}) => token = value.jwt, clearData: jasmine.createSpy('clearData')}}]});
    http = TestBed.inject(HttpClient); controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => controller.verify());

  it('shares one token refresh and preserves quiet background retries', () => {
    const context = () => new HttpContext().set(SkipLoading, true);
    http.get('/api/a', {context: context()}).subscribe();
    http.get('/api/b', {context: context()}).subscribe();
    controller.expectOne('/api/a').flush({}, {status: 401, statusText: 'Expired'});
    controller.expectOne('/api/b').flush({}, {status: 401, statusText: 'Expired'});
    const refresh = controller.match('/api/auth/refresh');
    expect(refresh.length).toBe(1);
    expect(refresh[0].request.context.get(SkipLoading)).toBeTrue();
    refresh[0].flush({data: {jwt: 'new', refresh: 'refresh'}});
    for (const url of ['/api/a', '/api/b']) {
      const retry = controller.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
      expect(retry.request.context.get(SkipLoading)).toBeTrue();
      retry.flush({});
    }
  });

  it('keeps normal loading for a user-triggered request and its token refresh', () => {
    http.get('/api/manual').subscribe();
    controller.expectOne('/api/manual').flush({}, {status: 401, statusText: 'Expired'});
    const refresh = controller.expectOne('/api/auth/refresh');
    expect(refresh.request.context.get(SkipLoading)).toBeFalse();
    refresh.flush({data: {jwt: 'new', refresh: 'refresh'}});
    const retry = controller.expectOne('/api/manual');
    expect(retry.request.context.get(SkipLoading)).toBeFalse();
    retry.flush({});
  });
});
