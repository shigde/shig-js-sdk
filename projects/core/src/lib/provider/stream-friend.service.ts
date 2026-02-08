import {Injectable} from '@angular/core';
import {HttpClient, HttpEventType, HttpHeaders} from '@angular/common/http';
import {MessageService} from './message.service';
import {filter, map, Observable, of, tap} from 'rxjs';
import {ApiResponse, Stream, StreamFriend, StreamPreview} from '../entities';
import {ParameterService} from './parameter.service';
import {createLogger} from "./logger";

@Injectable({providedIn: 'root'})
export class StreamFriendService {
  private readonly log = createLogger('StreamFriendService');

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
  };

  constructor(
    private http: HttpClient,
    private params: ParameterService
  ) {
  }

  /** GET Friends of Stream from the server */
  getStreamFriendsList(streamUuid: string): Observable<StreamFriend[]> {
    return this.http.get<ApiResponse<StreamFriend[]>>(`${this.params.API_PREFIX}/stream/${streamUuid}/friends`, this.httpOptions).pipe(map((res) => res.data))
  }

  /** GET specific friend of Streams from the server */
  getStreamFriend(streamUuid: string, userUuid: string): Observable<StreamFriend> {
    return this.http.get<ApiResponse<StreamFriend>>(`${this.params.API_PREFIX}/stream/${streamUuid}/friend/${userUuid}`, this.httpOptions).pipe(map((res) => res.data))
  }

  /** CREATE specific friend of Streams from the server */
  addStreamFriend(streamUuid: string, userUuid: string): Observable<StreamFriend> {
    return this.http.post<ApiResponse<StreamFriend>>(`${this.params.API_PREFIX}/stream/${streamUuid}/friend/${userUuid}`, this.httpOptions).pipe(map((res) => res.data))
  }

  /** DELETE specific friend of Streams from the server */
  removeStreamFriend(streamUuid: string, userUuid: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.params.API_PREFIX}/stream/${streamUuid}/friend/${userUuid}`, this.httpOptions).pipe(map((res) => res.data))
  }
}
