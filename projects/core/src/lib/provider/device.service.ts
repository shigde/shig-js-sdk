import {HttpBackend, HttpClient} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {map, switchMap} from 'rxjs';
import {ApiResponse, Device, DeviceInvite, DeviceSession} from '../entities';
import {ParameterService} from './parameter.service';
import {SettingsService} from './settings.service';

@Injectable({providedIn: 'root'})
export class DeviceService {
  // Device credentials use their own session and must bypass account token refresh.
  private readonly deviceHttp = new HttpClient(inject(HttpBackend));

  constructor(
    private http: HttpClient,
    private params: ParameterService,
    private settings: SettingsService,
  ) {}

  list() {
    return this.http.get<ApiResponse<Device[]>>(this.url()).pipe(map(response => response.data));
  }

  create(name: string) {
    return this.http.post<ApiResponse<Device>>(this.url(), {name}).pipe(map(response => response.data));
  }

  update(uuid: string, changes: Partial<Pick<Device, 'name' | 'active'>>) {
    return this.http.patch<ApiResponse<Device>>(this.url(uuid), changes).pipe(map(response => response.data));
  }

  remove(uuid: string) {
    return this.http.delete<void>(this.url(uuid));
  }

  invite(uuid: string, streamUuid: string) {
    return this.settings.getSettings().pipe(switchMap(({domain, tls}) => {
      const scheme = tls ? 'https' : 'http';
      const url = new URL('/camera', `${scheme}://${domain}`);
      return this.http.post<ApiResponse<{token: string}>>(`${this.url(uuid)}/invite`, {streamUuid})
        .pipe(map(({data}): DeviceInvite => {
          url.hash = data.token;
          return {url: url.href};
        }));
    }));
  }

  redeem(token: string) {
    return this.deviceHttp.post<ApiResponse<DeviceSession>>(`${this.params.API_PREFIX}/auth/device/redeem`, {token})
      .pipe(map(response => response.data));
  }

  publish(token: string, offer: RTCSessionDescription) {
    return this.deviceHttp.post(`${this.params.API_PREFIX}/auth/device/whip`, offer.sdp, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/sdp',
        Accept: 'application/sdp',
      },
      responseType: 'text',
    });
  }

  disconnect(token: string) {
    return this.deviceHttp.post<void>(this.disconnectUrl(), null, {
      headers: {Authorization: `Bearer ${token}`},
    });
  }

  disconnectOnPageExit(token: string): void {
    void fetch(this.disconnectUrl(), {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
      keepalive: true,
    }).catch(() => undefined);
  }

  private disconnectUrl(): string {
    return `${this.params.API_PREFIX}/auth/device/disconnect`;
  }

  private url(uuid?: string): string {
    const base = `${this.params.API_PREFIX}/devices`;
    return uuid ? `${base}/${encodeURIComponent(uuid)}` : base;
  }
}
