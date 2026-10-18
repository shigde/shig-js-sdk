import {of} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {SkipLoading} from '../interceptors/loading.interceptor';
import {LobbyService} from './lobby.service';
import {ParameterService} from './parameter.service';
import {MessageService} from './message.service';

describe('LobbyService host presence', () => {
  it('uses the existing SkipLoading context for background requests', () => {
    const get = jasmine.createSpy('get').and.returnValue(of({data: true}));
    const service = new LobbyService({get} as unknown as HttpClient, {} as MessageService,
      {API_PREFIX: '/api'} as ParameterService);
    service.hostPresence('channel', 'stream').subscribe();
    const [url, options] = get.calls.mostRecent().args;
    expect(url).toBe('/api/channel/channel/stream/stream/lobby/host');
    expect(options.context.get(SkipLoading)).toBeTrue();
  });
});
