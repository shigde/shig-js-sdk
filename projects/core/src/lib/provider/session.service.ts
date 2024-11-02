import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {ClientUser} from '../entities';
import {User} from '../entities/user';

const USER_NAME_KEY = 'user-name';
const USER_DOMAIN_KEY = 'user-domain';
const SESSION_TOKEN_KEY = 'jwt';

@Injectable({
    providedIn: 'root'
})
export class SessionService {
    private readonly userName$: Subject<string>;
    private readonly anonymous = 'anonymous';

    constructor() {
        const user = window.localStorage.getItem(USER_NAME_KEY);
        this.userName$ = new BehaviorSubject<string>(user === null ? this.anonymous : user);
    }

    public setAuthenticationToken(token: string) {
        window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    }

    public getAuthenticationToken(): string | null {
        return window.localStorage.getItem(SESSION_TOKEN_KEY);
    }

    isActive(): Observable<boolean> {
        if (this.getAuthenticationToken() !== null) {
            return of(true);
        }
       return of(false)
    }

    getUserName(): Observable<string> {
        return this.userName$;
    }

    public clearData() {
        window.localStorage.clear();
        this.userName$.next(this.anonymous);
    }


    public setUser(user: User) {
        window.localStorage.setItem(USER_NAME_KEY, user.name);
        window.localStorage.setItem(USER_DOMAIN_KEY, user.domain);
        this.userName$.next(user.name);
    }

    public removeUser(key: string) {
        window.localStorage.removeItem(USER_NAME_KEY);
        window.localStorage.removeItem(USER_DOMAIN_KEY);
        this.userName$.next(this.anonymous);
    }
}
