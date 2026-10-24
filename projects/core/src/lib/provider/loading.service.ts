import {BehaviorSubject} from 'rxjs';
import {Injectable} from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class LoadingService {
    private activeRequests = 0;
    private loadingSubject = new BehaviorSubject<boolean>(false);

    loading$ = this.loadingSubject.asObservable();

    loadingOn() {
        this.activeRequests++;
        if (this.activeRequests === 1) this.loadingSubject.next(true);
    }

    loadingOff() {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
        if (this.activeRequests === 0) this.loadingSubject.next(false);
    }
}
