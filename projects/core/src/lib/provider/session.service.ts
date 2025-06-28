import {Injectable} from '@angular/core';
import {BehaviorSubject, catchError, map, mergeMap, Observable, of, Subject, tap} from 'rxjs';
import {ApiResponse, Role, Token, User} from '../entities';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';

const ANONYMOUS = 'anonymous';
const SESSION_TOKEN_KEY = 'jwt';
const REFRESH_TOKEN_KEY = 'refresh';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  public readonly principalSubject = new BehaviorSubject<User | null>(null);

  constructor(private http: HttpClient, private params: ParameterService) {
  }

  public isAuthenticated(): boolean {
    return !!this.getAuthenticationToken();
  }

  public setAuthenticationToken(token: string) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  }

  public getAuthenticationToken(): string | null {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  }

  public setRefreshToken(token: string) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  public getRefreshToken(): string | null {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  public initPrincipal(): Observable<void> {
    const userUrl = `${this.params.API_PREFIX}/auth/user`;
    const httpOptions = {
      headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
    };
    // returns 200 || 403

    const tt = this.principalSubject;
    return this.http.get<ApiResponse<User>>(userUrl, httpOptions).pipe(
      map((res) => res.data),
      tap((u) => {
        tt.next(u);
        console.log('############## set user', u);
      }),
      map((u) => {}),
      catchError((err) => {
        console.log('############## cleare data', err);
        //this.clearData();
        return of();
      })
    );
  }

  public getUser(): Observable<User | null> {
    return this.principalSubject.asObservable();
  }

  public getUserRole(): Observable<Role> {
    return this.getUser().pipe(map((user) => user !== null ? user.role : Role.ANONYMOUS));
  }

  public isActive(): Observable<boolean> {
    return of(this.isAuthenticated());
  }

  public getUserName(): Observable<string> {
    return this.getUser().pipe(map((user) => user !== null ? user.name : ANONYMOUS));
  }

  public setToken(token: Token) {
    this.setAuthenticationToken(token.jwt);
    this.setRefreshToken(token.refresh);
  }

  public clearData() {
    console.log('############## cleare data');
    window.localStorage.clear();
    this.principalSubject.next(null);
  }
}
