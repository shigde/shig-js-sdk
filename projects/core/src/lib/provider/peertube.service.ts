import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {catchError, Observable, of} from 'rxjs';
import {MessageService} from './message.service';
import {StreamLiveData} from '../entities';

@Injectable({
    providedIn: 'root'
})
export class PeerTubeService {

    constructor(private http: HttpClient, private messageService: MessageService) {
    }

    public fetchStreamLiveData(token: string, stream: string): Observable<StreamLiveData> {
        return this.http.get<StreamLiveData>(`/api/v1/videos/live/${stream}`, {
            headers: new HttpHeaders({
                'Authorization': token,
                'Content-Type': 'application/json'
            })
        }).pipe(catchError(this.handleError<any>('no live data')));
    }

    private handleError<T>(operation = 'operation', result?: T) {
        return (error: any): Observable<T> => {

            // TODO: send the error to remote logging infrastructure
            console.error(error); // log to console instead

            // TODO: better job of transforming error for user consumption
            this.log(`${operation} failed: ${error.message}`);

            // Let the app keep running by returning an empty result.
            return of(result as T);
        };
    }

    /** Log a SpaceService message with the MessageService */
    private log(message: string) {
        this.messageService.add(`SpaceService: ${message}`);
    }
}
