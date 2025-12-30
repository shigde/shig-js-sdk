import {Injectable} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {MessageService} from './message.service';
import {catchError, map, Observable, of, tap} from 'rxjs';
import {Space} from '../entities/space';
import {ParameterService} from './parameter.service';
import {createLogger} from './logger';

/**
 * @deprecate
 */
@Injectable({providedIn: 'root'})
export class SpaceService {
  private readonly log= createLogger('SpaceService');

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json'})
  };

    /**
     * @deprecate
     * @param http
     * @param messageService
     * @param params
     */
  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private params: ParameterService
  ) {
  }

  /** GET Spaces from the server */
  getSpaces(): Observable<Space[]> {
    return this.http.get<Space[]>(`${this.params.API_PREFIX}/spaces`)
      .pipe(
        tap(_ => this.log.info('fetched spaces')),
        catchError(this.handleError<Space[]>('getSpaces', []))
      );
  }

  /** GET space by id. Return `undefined` when id not found */
  getSpaceNo404<Data>(id: string): Observable<Space> {
    const url = `${this.params.API_PREFIX}/?id=${id}`;
    return this.http.get<Space[]>(url)
      .pipe(
        map(spaces => spaces[0]), // returns a {0|1} element array
        tap(h => {
          const outcome = h ? 'fetched' : 'did not find';
          this.log.info(`${outcome} space id=${id}`);
        }),
        catchError(this.handleError<Space>(`getSpace id=${id}`))
      );
  }

  /** GET space by id. Will 404 if id not found */
  getSpace(id: string): Observable<Space> {
    const url = `${this.params.API_PREFIX}/space/${id}`;
    return this.http.get<Space>(url).pipe(
      tap(_ => this.log.info(`fetched space id=${id}`)),
      catchError(this.handleError<Space>(`getSpace id=${id}`))
    );
  }

  /* GET spacees whose name contains search term */
  searchSpaces(term: string): Observable<Space[]> {
    if (!term.trim()) {
      // if not search term, return empty space array.
      return of([]);
    }
    return this.http.get<Space[]>(`${this.params.API_PREFIX}/space/?name=${term}`).pipe(
      tap(x => x.length ?
        this.log.info(`found spaces matching "${term}"`) :
        this.log.info(`no spaces matching "${term}"`)),
      catchError(this.handleError<Space[]>('searchSpaces', []))
    );
  }

  //////// Save methods //////////

  /** POST: add a new space to the server */
  addSpace(space: Space): Observable<Space> {
    return this.http.post<Space>(`${this.params.API_PREFIX}/space`, space, this.httpOptions).pipe(
      tap((newSpace: Space) => this.log.info(`added space w/ id=${newSpace.id}`)),
      catchError(this.handleError<Space>('addSpace'))
    );
  }

  /** DELETE: delete the space from the server */
  deleteSpace(id: string): Observable<Space> {
    const url = `${this.params.API_PREFIX}/space/${id}`;

    return this.http.delete<Space>(url, this.httpOptions).pipe(
      tap(_ => this.log.info(`deleted space id=${id}`)),
      catchError(this.handleError<Space>('deleteSpace'))
    );
  }

  /** PUT: update the space on the server */
  updateSpace(space: Space): Observable<any> {
    return this.http.put(`${this.params.API_PREFIX}/space`, space, this.httpOptions).pipe(
      tap(_ => this.log.info(`updated space id=${space.id}`)),
      catchError(this.handleError<any>('updateSpace'))
    );
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   *
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      this.log.error(error);

      // TODO: better job of transforming error for user consumption
      this.logMessage(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  /** Log a SpaceService message with the MessageService */
  private logMessage(message: string) {
    this.messageService.add(`SpaceService: ${message}`);
  }
}
