import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {User} from '../entities';

@Injectable({
    providedIn: 'root'
})
export class SessionService {
    private readonly users: User[] = [
        {id: 'root@localhost:9000', name: 'root@localhost:9000', token: token1},
        {id: 'user123@localhost:9000', name: 'user123@localhost:9000', token: token2},
        {id: 'guest-2', name: 'Guest 2', token: token3},
        {id: 'guest-3', name: 'Guest 3', token: token4},
        {id: 'guest-4', name: 'Guest 4', token: token5},
    ];

    private readonly userName$: Subject<string>;
    private readonly anonymous = 'anonymous';

    private authToken: string | undefined;

    constructor() {
        const user = localStorage.getItem('user');
        this.userName$ = new BehaviorSubject<string>(user === null ? this.anonymous : user);
    }

    setAuthenticationToken(token: string) {
        this.authToken = token;
    }

    isActive(): Observable<boolean> {
        if (this.authToken !== undefined) {
            return of(true);
        }
        const user = localStorage.getItem('user');
        return of(user !== null);
    }

    getUserName(): Observable<string> {
        return this.userName$;
    }

    setUserName(user: User): boolean {
        const found = this.users.find((list) => list.id === user.id);
        if (found === undefined) {
            return false;
        }
        localStorage.setItem('user', user.name);
        this.userName$.next(user.name);
        return true;
    }

    getUsers(): User[] {
        return this.users;
    }

    public removeUser(key: string) {
        localStorage.removeItem('user');
        this.userName$.next(this.anonymous);
    }

    public clearData() {
        localStorage.clear();
        this.userName$.next(this.anonymous);
    }

    public getToken(): string {
        if (this.authToken !== undefined) {
            return this.authToken;
        }

        let userName = localStorage.getItem('user');
        if (userName === null) {
            return '';
        }
        const user = this.users.find(items => items.name === userName);
        if (user === undefined) {
            return '';
        }

        return `Bearer ${user.token}`;
    }
}

const token1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJ1dWlkIjoiMWY1NjA2NmYtYjA1Yi00NDhhLWI3NjUtYjhkYzJiZTU1OTY3In0.GV0ptLGhnA0gwJC5zlKPY5z94KfLYUEpDraQmXPAR4o';
const token2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJ1dWlkIjoiOGRhMGNkYzItZTVmMS00ZmZiLWIwYTktYWYxODI0MzI5OTQ0In0.CVk4I_9BP5yQuFS4X6XNZsvQ7tFStn3eGXGtNVYvSjY';
const token3 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJ1dWlkIjoiNzBiZTg2ODItNzk5Yy00MjdmLWI3MjgtZmQwMDhjNTYzYWFjIn0.mLT7DRp50QP6OqqxBQmf4VSx02i3cA0jk89UMdXLhBY';
const token4 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJ1dWlkIjoiMjhiYmYzNTctYTFmNy00NDkwLWIxZjItYTYzN2E0YWU5YmFlIn0.wMfmkJ0VBj86tW5NfQnnV91j2YT-mUZeM_E9qbt_bjg';
const token5 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJ1dWlkIjoiZmUwMjI2NDgtYTBlOS00NDQ0LTlkNGQtYTRjMGQ5ZWZiNmQ3In0.HgWacVwFeEgYBG6iDJYlQ25VTymM0xHpnppjWGrzOp4';
