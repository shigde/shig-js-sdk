import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {SessionService} from '../provider';
import {Router} from '@angular/router';
import {catchError, Observable, of, throwError} from 'rxjs';
import {Injectable} from '@angular/core';

@Injectable()
export class UnauthorizedInterceptor implements HttpInterceptor {
    constructor(private router: Router, private session: SessionService) {
    }

    intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        return next.handle(req).pipe(
            catchError((error): Observable<HttpEvent<unknown>>  => {
                if (error instanceof HttpErrorResponse && error.status === 401) {
                    this.session.clearData();
                    this.router.navigateByUrl('/', {replaceUrl: true});
                    return of()
                } else {
                    return throwError(error);
                }
            })
        );
    }
}

