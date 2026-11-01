import {TestBed} from '@angular/core/testing';
import {of, throwError} from 'rxjs';
import {RecordedVideo} from '../entities';
import {MediaService} from './media.service';
import {VideoService} from './video.service';

const video = (uuid: string, status: RecordedVideo['status'] = 'recording'): RecordedVideo => ({
  uuid, type: 'video', sourceStreamUuid: 'stream', ownerUuid: 'owner', channelUuid: 'channel',
  title: 'Stream title', description: '', support: '', thumbnail: '', licence: 1, isPublic: true,
  publishedAt: null, status, durationMs: 1000, error: null,
  startedAt: null, endedAt: null, createdAt: '', updatedAt: '',
});

describe('MediaService video recording controls', () => {
  function setup() {
    const videos = {
      listForStream: jasmine.createSpy().and.returnValue(of([])),
      startRecording: jasmine.createSpy().and.returnValues(of(video('first')), of(video('second'))),
      stopRecording: jasmine.createSpy().and.returnValue(of(video('first', 'processing'))),
      update: jasmine.createSpy().and.returnValue(of({...video('first', 'ready'), publishedAt: '2026-10-31'})),
    };
    TestBed.configureTestingModule({providers: [{provide: VideoService, useValue: videos}]});
    return {media: TestBed.inject(MediaService), videos};
  }
  it('preserves the distinct video ID returned by every recording start', () => {
    const {media} = setup();
    const ids: (string | undefined)[] = [];
    media.startRecording('stream').subscribe(item => ids.push(item.videoUuid));
    media.startRecording('stream').subscribe(item => ids.push(item.videoUuid));
    expect(ids).toEqual(['first', 'second']);
  });
  it('stops and publishes the selected video, not its source stream', () => {
    const {media, videos} = setup();
    media.stopRecording('first').subscribe(item => expect(item.status).toBe('finalizing'));
    expect(videos.stopRecording).toHaveBeenCalledWith('first');
    media.setPublished('first', true).subscribe(item => expect(item.published).toBeTrue());
    expect(videos.update).toHaveBeenCalledWith('first', {published: true});
  });
  it('returns empty state for a stream without videos and prefers an active recording over newer metadata', () => {
    const {media, videos} = setup();
    media.getRecording('stream').subscribe(item => expect(item.status).toBe('empty'));
    videos.listForStream.and.returnValue(of([video('draft', 'pending'), video('active')]));
    media.getRecording('stream').subscribe(item => expect(item.videoUuid).toBe('active'));
  });
  it('does not turn a failed archive start into success', () => {
    const {media, videos} = setup();
    videos.startRecording.and.returnValue(throwError(() => new Error('Archive is not connected')));
    media.startRecording('stream').subscribe({next: () => fail('unexpected success'), error: error => expect(error.message).toContain('not connected')});
  });
});
