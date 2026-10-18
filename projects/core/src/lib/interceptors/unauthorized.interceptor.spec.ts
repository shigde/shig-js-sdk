import {HttpErrorResponse, HttpRequest} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {throwError} from 'rxjs';
import {SessionService} from '../provider';
import {UnauthorizedInterceptor} from './unauthorized.interceptor';
import {AuthInterceptor} from './auth.interceptor';
import {httpInterceptorProviders} from './index';

describe('Unauthorized interceptor registration', () => {
  it('wraps authentication so token refresh runs before unauthorized handling', () => {
    expect(httpInterceptorProviders[0].useClass).toBe(UnauthorizedInterceptor);
    expect(httpInterceptorProviders[1].useClass).toBe(AuthInterceptor);
  });

  it('clears the session on a final 401 and preserves the error for the caller', () => {
    const clearData = jasmine.createSpy('clearData');
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    TestBed.configureTestingModule({providers: [UnauthorizedInterceptor,
      {provide: SessionService, useValue: {clearData}},
      {provide: Router, useValue: {navigateByUrl}},
    ]});
    const error = new HttpErrorResponse({status: 401});
    const onError = jasmine.createSpy('onError');
    TestBed.inject(UnauthorizedInterceptor).intercept(new HttpRequest('GET', '/test'), {
      handle: () => throwError(() => error),
    }).subscribe({error: onError});
    expect(clearData).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/', {replaceUrl: true});
    expect(onError).toHaveBeenCalledWith(error);
  });
});
