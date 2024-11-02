import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {Role} from '../entities';
import {User} from '../entities/user';

const USER_KEY = 'user';
const SESSION_TOKEN_KEY = 'jwt';

@Injectable({
    providedIn: 'root'
})
export class SessionService {
    private readonly userName$: Subject<string>;
    private readonly anonymous = 'anonymous';

    constructor() {
        const user = this.loadUser();
        this.userName$ = new BehaviorSubject<string>(user === null ? this.anonymous : user.name);
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
        return of(false);
    }

    getUserName(): Observable<string> {
        return this.userName$;
    }

    public clearData() {
        window.localStorage.clear();
        this.userName$.next(this.anonymous);
    }

    getUserRole(): Role {
        if (!this.isActive()) {
            return Role.ANONYMOUS;
        }

        const user = this.loadUser();
        if (user === null) {
            return Role.ANONYMOUS;
        }
        return user.role;
    }

    public setUser(user: User) {
        this.saveUser(user);
        this.userName$.next(user.name);
    }

    public removeUser(key: string) {
        window.localStorage.removeItem(USER_KEY);
        this.userName$.next(this.anonymous);
    }

    private loadUser(): User | null {
        const user = window.localStorage.getItem(USER_KEY);
        if (user !== null) {
            return JSON.parse(user) as User;
        }
        return null;
    }

    private saveUser(user: User): void {
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
}
