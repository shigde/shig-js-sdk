import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {ApiResponse, ContentType, ReactionStats} from '../entities';
import {ParameterService} from './parameter.service';

@Injectable({providedIn: 'root'})
export class ReactionService {
  constructor(private http: HttpClient, private params: ParameterService) {}

  setLike(type: ContentType, uuid: string, liked: boolean): Observable<ReactionStats> {
    return this.http.post<ApiResponse<ReactionStats>>(
      `${this.params.API_PREFIX}/reactions/${type}/${encodeURIComponent(uuid)}`, {liked},
    ).pipe(map(response => response.data));
  }
}
