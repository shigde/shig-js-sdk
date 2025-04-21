import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {MessageService} from './message.service';
import {catchError, map, Observable, of, tap} from 'rxjs';
import {ApiResponse, Stream} from '../entities';
import {ParameterService} from './parameter.service';
import {streams} from '../entities/stream-fixtures';

@Injectable({providedIn: 'root'})
export class StreamService {

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json'})
  };

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private params: ParameterService
  ) {
  }

  /** GET Streams from the server */
  getChannelStreams(channelUuid: string): Observable<ApiResponse<Stream[]>> {
    // return this.http.get<ApiResponse<Stream[]>>(`${this.params.API_PREFIX}/pub/channel/${channelUuid}/stream`)
    //   .pipe(
    //     tap(_ => this.log(`get streams for channel ${channelUuid}`)),
    //     catchError(this.handleError<Stream[]>(`get streams for channel ${channelUuid}`, []))
    //   );
    return of({
      data: streams,
      message: 'fetched',
    })
  }

  /** GET Streams from the server */
  getPublicStreams(channelUuid: string): Observable<ApiResponse<Stream[]>> {
    // return this.http.get<ApiResponse<Stream[]>>(`${this.params.API_PREFIX}/pub/stream`)
    //   .pipe(
    //     tap(_ => this.log(`get streams for channel ${channelUuid}`)),
    //     catchError(this.handleError<Stream[]>(`get streams for channel ${channelUuid}`, []))
    //   );
    return of({
      data: streams,
      message: 'fetched',
    })
  }

  /** GET stream by id. Return `undefined` when id not found */
  getStream(uuid: string): Observable<ApiResponse<Stream>> {
    // return this.http.get<ApiResponse<Stream>>(`${this.params.API_PREFIX}/pub/stream/${uuid}`)
    //   .pipe(
    //     tap(_ => this.log(`get stream uuid=${uuid}`)),
    //     catchError(this.handleError<Stream>(`get stream uuid=${uuid}`))
    //   );
    return of({
      data: streams[0],
      message: 'fetched',
    })
  }

  /* GET streames whose name contains search term */
  searchStreams(term: string): Observable<ApiResponse<Stream[]>> {
    if (!term.trim()) {
      // if not search term, return empty stream array.
      return of({data: [], message: 'no results found'});
    }
    return this.http.get<ApiResponse<Stream[]>>(`${this.params.API_PREFIX}/pub/stream/search?name=${term}`).pipe(
      tap(x => x.data.length ?
        this.log(`found streams matching "${term}"`) :
        this.log(`no streams matching "${term}"`)),
      catchError(this.handleError<Stream[]>('searchStreams', []))
    );
  }

  //////// Save methods //////////

  /** POST: add a new stream to the server */
  addStream(stream: Stream): Observable<ApiResponse<Stream>> {
    return this.http.post<ApiResponse<Stream>>(`${this.params.API_PREFIX}/stream`, stream, this.httpOptions).pipe(
      tap((response) => this.log(`added stream w/ id=${response.data.uuid}`)),
      catchError(this.handleError<Stream>('add stream'))
    );
  }

  /** DELETE: delete the stream from the server */
  deleteStream(uuid: string): Observable<ApiResponse<string>> {
    const url = `${this.params.API_PREFIX}/stream/${uuid}`;

    return this.http.delete<ApiResponse<string>>(url, this.httpOptions).pipe(
      tap(_ => this.log(`deleted stream uuid=${uuid}`)),
      catchError(this.handleError<string>('deleteStream'))
    );
  }

  /** PUT: update the stream on the server */
  updateStream(stream: Stream): Observable<ApiResponse<Stream>> {
    return this.http.put<ApiResponse<Stream>>(`${this.params.API_PREFIX}/stream`, stream, this.httpOptions).pipe(
      tap(_ => this.log(`updated stream id=${stream.uuid}`)),
      catchError(this.handleError<Stream>('update stream'))
    );
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   *
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T): (error: any) => Observable<ApiResponse<T>> {
    return (error: any): Observable<ApiResponse<T>> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      this.log(`${operation} failed: ${error.message}`);

      const response: ApiResponse<T> = {
        data: result as T,
        message: error.message,
      };

      // Let the app keep running by returning an empty result.
      return of(response);
    };
  }

  /** Log a StreamService message with the MessageService */
  private log(message: string) {
    this.messageService.add(`StreamService: ${message}`);
  }
}
