import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {UserService} from './user.service';

describe('UserService admin accounts', () => {
  let service: UserService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads a page with a search and offset', () => {
    const page = {users: [], total: 51};
    service.getAdminUsers('channel', 50).subscribe(result => expect(result).toEqual(page));
    const request = http.expectOne(req => req.url === '/api/admin/users');
    expect(request.request.params.get('q')).toBe('channel');
    expect(request.request.params.get('offset')).toBe('50');
    request.flush({message: 'ok', data: page});
  });

  it('blocks and activates through the admin endpoint', () => {
    for (const active of [false, true]) {
      service.setUserActive('some-user', active).subscribe(result => expect(result).toBe(active));
      const request = http.expectOne('/api/admin/users/some-user/active');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({active});
      request.flush({message: 'ok', data: active});
    }
  });
  it('grants and removes admin rights through the role endpoint', () => {
    for (const role of [1, 2] as const) {
      service.setUserRole('some-user', role).subscribe(result => expect(result).toBe(role));
      const request = http.expectOne('/api/admin/users/some-user/role');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({role});
      request.flush({message: 'ok', data: role});
    }
  });

});
