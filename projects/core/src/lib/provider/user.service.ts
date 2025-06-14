import { Injectable } from '@angular/core';
import {map, Observable} from 'rxjs';
import {ApiResponse, User} from '../entities';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {SessionService} from './session.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
  };

  constructor(private http: HttpClient, private params: ParameterService, private session: SessionService) {
  }

  getUser(): Observable<User> {
    const userUrl = `${this.params.API_PREFIX}/pub/user`;
    // returns 200 || 403
    return this.http.get<ApiResponse<User>>(userUrl, this.httpOptions).pipe(map((res) => res.data));
  }
}
