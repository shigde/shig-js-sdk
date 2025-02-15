import {Injectable} from '@angular/core';
import {Account, ApiResponse, Token, User} from '../entities';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {map, mergeMap, Observable, tap} from 'rxjs';
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
        return this.http.post<ApiResponse<Token>>(loginUrl, body, this.httpOptions).pipe(
            tap((resp: ApiResponse<Token>) => this.session.setToken(resp.data)),
            mergeMap(() => this.getUser()),
            map((user) => this.session.setUser(user))
        );
    }

    refreshLogin(): Observable<void> {
        // Call the refresh token endpoint to get a new access token
        const token = this.session.getRefreshToken();
        const refreshUrl = `${this.params.API_PREFIX}/auth/refresh`;
        const body = {token};
        return this.http.post<ApiResponse<Token>>(refreshUrl, body, this.httpOptions).pipe(
            map((resp: ApiResponse<Token>) => this.session.setToken(resp.data))
        );
    }

    registerAccount(account: Account): Observable<void> {
        const url = `${this.params.API_PREFIX}/auth/register`;
        // returns 201 || 400
        return this.http.post<void>(url, account, this.httpOptions);
    }

    verifyAccount(token: String): Observable<void> {
        const url = `${this.params.API_PREFIX}/auth/verify/${token}`;
        // returns 200 || 400
        return this.http.get<void>(url, this.httpOptions);
    }

    sendForgotPasswordMail(email: string): Observable<void> {
        const url = `${this.params.API_PREFIX}/auth/pass/email`;
        // returns 201 || 400
        return this.http.post<void>(url, {email}, this.httpOptions);

    }

    updateForgotPassword(password: string, token: string) {
        const url = `${this.params.API_PREFIX}/auth/pass/reset`;
        // returns 201 || 400
        return this.http.put<void>(url, {password, token}, this.httpOptions);
    }

    updatePassword(old_password: string, new_password: string) {
        const url = `${this.params.API_PREFIX}/auth/pass/update`;
        // returns 201 || 400
        return this.http.put<void>(url, {old_password, new_password}, this.httpOptions);
    }

    deleteAccount() {
        const url = `${this.params.API_PREFIX}/auth/user`;
        // returns 403
        return this.http.delete<void>(url, this.httpOptions);
    }

    private getUser(): Observable<User> {
        const userUrl = `${this.params.API_PREFIX}/auth/user`;
        // returns 200 || 403
        return this.http.get<ApiResponse<User>>(userUrl, this.httpOptions).pipe(map((res) => res.data));
    }
}
