import {Injectable} from '@angular/core';
import {HttpClient, HttpContext, HttpHeaders} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {ApiResponse, StreamSettings, ScoreboardPreferences, ScenePreferences} from '../entities';
import {ParameterService} from './parameter.service';
import {SkipLoading} from '../interceptors/loading.interceptor';

@Injectable({providedIn: 'root'})
export class StreamSettingsService {
  private readonly httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
    context: new HttpContext().set(SkipLoading, true),
  };

  constructor(private http: HttpClient, private params: ParameterService) {}

  get(): Observable<StreamSettings> {
    return this.http.get<ApiResponse<StreamSettings>>(`${this.params.API_PREFIX}/user/stream-settings`, this.httpOptions)
      .pipe(map(response => response.data));
  }

  saveScoreboard(scoreboard: ScoreboardPreferences): Observable<StreamSettings> {
    return this.update({scoreboard});
  }

  saveScenes(scenes: ScenePreferences): Observable<StreamSettings> {
    return this.update({scenes});
  }

  private update(patch: Partial<StreamSettings>): Observable<StreamSettings> {
    return this.http.patch<ApiResponse<StreamSettings>>(
      `${this.params.API_PREFIX}/user/stream-settings`, patch, this.httpOptions,
    ).pipe(map(response => response.data));
  }
}
