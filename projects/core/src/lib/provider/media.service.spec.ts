import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {MediaService} from './media.service';
import {ParameterService} from './parameter.service';

describe('MediaService', () => {
  let media: MediaService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: ParameterService, useValue: {API_PREFIX: '/api'}},
    ]});
    media = TestBed.inject(MediaService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('keeps recording and publication as separate server operations', () => {
    media.startRecording('stream').subscribe(value => expect(value.status).toBe('recording'));
    const start = http.expectOne('/api/stream/stream/recording');
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({});
    start.flush({data: {streamUuid: 'stream', status: 'recording', published: false, durationMs: 0}});
    media.setPublished('stream', false).subscribe(value => expect(value.published).toBeFalse());
    const publish = http.expectOne('/api/stream/stream/recording/publication');
    expect(publish.request.method).toBe('PUT');
    expect(publish.request.body).toEqual({published: false});
    publish.flush({data: {streamUuid: 'stream', status: 'ready', published: false, durationMs: 1000}});
  });
  it('propagates errors and does not report a failed start as successful', () => {
    let failed = false;
    media.startRecording('stream').subscribe({next: () => fail('unexpected success'), error: () => failed = true});
    http.expectOne('/api/stream/stream/recording').flush({message: 'Stream is not live'}, {status: 409, statusText: 'Conflict'});
    expect(failed).toBeTrue();
  });
  it('stops recording through the current server endpoint', () => {
    media.stopRecording('stream').subscribe(value => expect(value.status).toBe('ready'));
    const stop = http.expectOne('/api/stream/stream/recording');
    expect(stop.request.method).toBe('DELETE');
    stop.flush({data: {streamUuid: 'stream', status: 'ready', published: false, durationMs: 1000}});
  });
});
