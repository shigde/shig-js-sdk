import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {VideoService} from './video.service';
import {ParameterService} from './parameter.service';

describe('VideoService REST resources', () => {
  let service: VideoService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: ParameterService, useValue: {API_PREFIX: '/api'}},
    ]});
    service = TestBed.inject(VideoService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('waits for recording readiness in one request', () => {
    service.waitForRecordingReady('stream/id').subscribe();
    const request = http.expectOne('/api/streams/stream%2Fid/recordings/ready');
    expect(request.request.method).toBe('GET');
    request.flush(null, {status: 204, statusText: 'No Content'});
  });
  it('fetches recorded video previews separately and converts their dates', () => {
    service.getPreview('video/id').subscribe(preview => {
      expect(preview.type).toBe('video');
      expect(preview.date).toEqual(new Date('2026-11-01T10:00:00Z'));
      expect(preview.startTime).toEqual(new Date('2026-11-01T10:00:00Z'));
      expect(preview.endTime).toBeNull();
    });
    http.expectOne('/api/pub/recorded-video-preview/video%2Fid').flush({data: {
      type: 'video', date: '2026-11-01T10:00:00', startTime: '2026-11-01T10:00:00Z', endTime: null,
    }});
    service.getPreviewList().subscribe(previews => expect(previews).toEqual([]));
    http.expectOne('/api/pub/recorded-video-preview').flush({data: []});
    service.getChannelPreviewList('channel/id').subscribe(previews => expect(previews).toEqual([]));
    http.expectOne('/api/pub/channel/channel%2Fid/recorded-video-preview').flush({data: []});
  });
  it('creates recording resources beneath the source and addresses stop by video ID', () => {
    service.startRecording('source').subscribe();
    const start = http.expectOne('/api/streams/source/recordings');
    expect(start.request.method).toBe('POST'); start.flush({data: {uuid: 'video'}});
    service.stopRecording('video').subscribe();
    const stop = http.expectOne('/api/videos/video/stop');
    expect(stop.request.method).toBe('POST'); stop.flush({data: {uuid: 'video'}});
  });
  it('updates video metadata independently of the livestream', () => {
    service.update('video', {title: 'New title', published: false}).subscribe();
    const request = http.expectOne('/api/videos/video');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({title: 'New title', published: false});
    request.flush({data: {uuid: 'video'}});
  });
});
