import { Injectable } from '@angular/core';
import {map, Observable} from 'rxjs';
import {AdminUserPage, ApiResponse, Role, User} from '../entities';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {PollingService, PollState} from './polling.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
  };

  constructor(private http: HttpClient, private params: ParameterService, private polling: PollingService) {
  }

  getUser(uuid: string): Observable<User> {
    const userUrl = `${this.params.API_PREFIX}/pub/user/${uuid}`;
    // returns 200 || 403
    return this.http.get<ApiResponse<User>>(userUrl, this.httpOptions).pipe(map((res) => res.data));
  }

  searchUser(search: string): Observable<User[]> {
    return this.http
      .get<ApiResponse<User[]>>(
        `${this.params.API_PREFIX}/pub/user/search`,
        {
          ...this.httpOptions,
          params: { q: search }
        }
      )
      .pipe(map(res => res.data));
  }
  /** Admin-only, 50 accounts per page, newest registrations first. */
  getAdminUsers(search = '', offset = 0): Observable<AdminUserPage> {
    return this.http.get<ApiResponse<AdminUserPage>>(`${this.params.API_PREFIX}/admin/users`, {
      ...this.httpOptions, params: {q: search, offset}
    }).pipe(map(res => res.data));
  }

  setUserActive(uuid: string, active: boolean): Observable<boolean> {
    return this.http.patch<ApiResponse<boolean>>(
      `${this.params.API_PREFIX}/admin/users/${encodeURIComponent(uuid)}/active`,
      {active}, this.httpOptions
    ).pipe(map(res => res.data));
  }
  setUserRole(uuid: string, role: Role.ADMIN | Role.USER): Observable<Role> {
    return this.http.patch<ApiResponse<Role>>(
      `${this.params.API_PREFIX}/admin/users/${encodeURIComponent(uuid)}/role`,
      {role}, this.httpOptions
    ).pipe(map(res => res.data));
  }

  setChannelStreaming(uuid: string, status: 'inherited' | 'allowed' | 'blocked'): Observable<string> {
    return this.http.patch<ApiResponse<string>>(
      `${this.params.API_PREFIX}/admin/users/${encodeURIComponent(uuid)}/streaming`,
      {status}, this.httpOptions
    ).pipe(map(res => res.data));
  }

  getStreamingPolicy(): Observable<{mode: 'request' | 'open' | 'locked'}> {
    return this.http.get<ApiResponse<{mode: 'request' | 'open' | 'locked'}>>(
      `${this.params.API_PREFIX}/admin/streaming-policy`, this.httpOptions
    ).pipe(map(res => res.data));
  }

  setStreamingPolicy(mode: 'request' | 'open' | 'locked'): Observable<string> {
    return this.http.patch<ApiResponse<string>>(
      `${this.params.API_PREFIX}/admin/streaming-policy`, {mode}, this.httpOptions
    ).pipe(map(res => res.data));
  }

  requestStreaming(): Observable<string> {
    return this.http.post<ApiResponse<string>>(`${this.params.API_PREFIX}/channel/streaming-request`, {}, this.httpOptions).pipe(map(res => res.data));
  }

  getMyStreamingPolicy(): Observable<{mode: 'request' | 'open' | 'locked'; channelStatus: string; canStream: boolean}> {
    return this.http.get<ApiResponse<{mode: 'request' | 'open' | 'locked'; channelStatus: string; canStream: boolean}>>(
      `${this.params.API_PREFIX}/channel/streaming-policy`, this.httpOptions
    ).pipe(map(res => res.data));
  }

  watchMyStreamingPolicy(): Observable<PollState<{mode: 'request' | 'open' | 'locked'; channelStatus: string; canStream: boolean}>> {
    const url = `${this.params.API_PREFIX}/channel/streaming-policy`;
    return this.polling.watch({
      key: 'streaming-policy', intervalMs: 15000, requiresSession: true, batch: {resource: 'streaming-policy'},
      load: context => this.http.get<ApiResponse<{mode: 'request' | 'open' | 'locked'; channelStatus: string; canStream: boolean}>>(
        url, {...this.httpOptions, context}
      ).pipe(map(res => res.data))
    });
  }

  refreshMyStreamingPolicy(): void { this.polling.refresh('streaming-policy'); }
}
