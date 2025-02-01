import {Injectable} from '@angular/core';
import {Account, Token, User} from '../entities';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {catchError, lastValueFrom, map, mergeMap, Observable, tap} from 'rxjs';
import {handleError} from './error.handler';
import {SessionService} from './session.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    httpOptions = {
        headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
    };

    constructor(private http: HttpClient, private params: ParameterService, private session: SessionService) {
    }

    login(email: string, pass: string): Observable<void> {
        const loginUrl = `${this.params.API_PREFIX}/auth/login`;
        const body = {email, pass};
        // returns 200 || 403
        return this.http.post<Token>(loginUrl, body, this.httpOptions).pipe(
            tap((token: Token) => this.session.setAuthenticationToken(token.jwt)),
            mergeMap(() => this.getUser()),
            map((user) => this.session.setUser(user))
        );
    }

    registerAccount(account: Account): Observable<void> {
        const url = `${this.params.API_PREFIX}/auth/register`;
        // returns 201 || 400
        return this.http.post<void>(url, account, this.httpOptions);
    }

    verifyAccount(token: String): Observable<void> {
        const url = `${this.params.API_PREFIX}/auth/verify`;
        // returns 200 || 400
        return this.http.put<void>(url, {token}, this.httpOptions);
    }

    sendForgotPasswordMail(email: string): Observable<void>  {
        const url = `${this.params.API_PREFIX}/auth/sendForgotPasswordMail`;
        // returns 201 || 400
        return this.http.post<void>(url, {email}, this.httpOptions);

    }

    updateForgotPassword(password: string, token: string) {
        const url = `${this.params.API_PREFIX}/auth/updateForgotPassword`;
        // returns 201 || 400
        return this.http.put<void>(url, {password, token}, this.httpOptions);
    }

    updatePassword(oldPassword: string, newPassword: string) {
        const url = `${this.params.API_PREFIX}/auth/updatePassword`;
        // returns 201 || 400
        return this.http.put<void>(url, {oldPassword, newPassword}, this.httpOptions);
    }

    deleteAccount(email: string) {
        const url = `${this.params.API_PREFIX}/auth/deleteAccount`;
        const body = {email};

        return this.http.post<void>(url, {email}, this.httpOptions);
    }

    private getUser(): Observable<User> {
        const userUrl = `${this.params.API_PREFIX}/auth/user`;
        // returns 200 || 403
        return this.http.get<User>(userUrl, this.httpOptions);
    }
}
