import {Injectable} from '@angular/core';
import {HttpRequest, HttpHandler, HttpEvent, HttpInterceptor} from '@angular/common/http';
import {catchError, map, mergeMap, Observable, switchMap, throwError} from 'rxjs';
import {AuthService, SessionService} from '../provider';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private session: SessionService, private autService: AuthService) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.session.getAuthenticationToken();
    if (token != null) {
      const cloned = this.addToken(request, token);
      return next.handle(cloned).pipe(
        catchError((error) => {
          // Check if the error is due to an expired access token
          if (error.status === 401) {
            return this.handleTokenExpired(request, next);
          }
          return throwError(error);
        })
      );
    }
    return next.handle(request);
  }

  private handleTokenExpired(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Call the refresh token endpoint to get a new access token
    return this.autService.refreshLogin().pipe(
      switchMap(() => {
        // Retry the original request with the new access token
        const newToken = this.session.getAuthenticationToken();
        return next.handle(this.addToken(request, `${newToken}`));
      }),
      catchError((error) => {
        // Handle refresh token error (e.g., redirect to login page)
        console.error('Error handling expired access token:', error);
        return throwError(error);
      })
    );
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}
