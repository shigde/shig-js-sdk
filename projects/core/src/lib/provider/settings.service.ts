import {Injectable} from '@angular/core';
import {Settings} from '../entities/settings';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {SessionService} from './session.service';
import {map, Observable, of, take, tap} from 'rxjs';
import {ApiResponse, User} from '../entities';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  private settings!: Settings;

  private httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
  };

  constructor(private http: HttpClient, private params: ParameterService) {

  }

  getSettings(): Observable<Settings> {
    if (this.settings !== undefined) {
      return of(this.settings);
    }

    const url = `${this.params.API_PREFIX}/pub/federation/settings`;
    return this.http.get<ApiResponse<Settings>>(url, this.httpOptions).pipe(
      take(1),
      tap((res) => {
        this.settings = res.data;
      }),
      map((res) => res.data)
    );
  }
}
