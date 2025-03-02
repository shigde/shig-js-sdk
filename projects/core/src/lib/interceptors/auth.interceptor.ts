import {Injectable} from '@angular/core';
import {HttpRequest, HttpHandler, HttpEvent, HttpInterceptor} from '@angular/common/http';
import {catchError, map, mergeMap, Observable, switchMap, throwError} from 'rxjs';
import {AuthService, SessionService} from '../provider';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    constructor(private session: SessionService, private autService: AuthService) {
    }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        return this.session.isActive()
            .pipe(
                map(isActive => {
                    if (isActive) {
                        request = this.addToken(request);
                    }
                    return {request, isActive};
                }),
                mergeMap((data) => {
                    return next.handle(data.request).pipe(
                        catchError((error) => {
                            // Check if the error is due to an expired access token
                            if (error.status === 401 && data.isActive) {
                                return this.handleTokenExpired(request, next);
                            }
                            return throwError(error);
                        })
                    );
                })
            );
    }

    private handleTokenExpired(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Call the refresh token endpoint to get a new access token
        return this.autService.refreshLogin().pipe(
            switchMap(() => {
                // Retry the original request with the new access token
                return next.handle(this.addToken(request));
            }),
            catchError((error) => {
                // Handle refresh token error (e.g., redirect to login page)
                console.error('Error handling expired access token:', error);
                return throwError(error);
            })
        );
    }

    private addToken(request: HttpRequest<any>): HttpRequest<any> {
        const token = this.session.getAuthenticationToken();
        return request.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`,
            },
        });
    }
}
