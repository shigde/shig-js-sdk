import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {InboxService} from './inbox.service';
import {ParameterService} from './parameter.service';
import {SessionService} from './session.service';

@Injectable({providedIn: 'root'})
export class NotificationService extends InboxService {
  constructor(http: HttpClient, params: ParameterService, session: SessionService) {
    super(http, params, session, 'notifications');
  }
}
