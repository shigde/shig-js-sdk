import {Injectable} from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import {map, mergeMap, Observable} from 'rxjs';
import {SessionService} from '../provider';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private session: SessionService) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {

    return this.session.isActive()
      .pipe(
        map(isActive => {
          if (isActive) {
            const token = this.session.getToken();
            request = request.clone({
              setHeaders: {
                Authorization: token,
              },
            });
          }
          return request;
        }),
        mergeMap((req) => next.handle(req)));
  }
}
