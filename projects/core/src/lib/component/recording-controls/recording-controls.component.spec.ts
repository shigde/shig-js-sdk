import {TestBed} from '@angular/core/testing';
import {of, Subject, throwError} from 'rxjs';
import {MediaRecording} from '../../entities/media-recording';
import {MediaService} from '../../provider/media.service';
import {VideoService} from '../../provider/video.service';
import {RecordedVideo} from '../../entities/recorded-video';
import {RecordingControlsComponent} from './recording-controls.component';

describe('Lobby recording completion', () => {
  const recording = (status: MediaRecording['status']): MediaRecording => ({
    streamUuid: 'stream', videoUuid: 'video', status, published: false, durationMs: 12000,
  });

  function setup() {
    const updates = new Subject<MediaRecording>();
    const media = {
      getRecording: jasmine.createSpy().and.returnValue(of(recording('recording'))),
      stopRecording: jasmine.createSpy().and.returnValue(updates),
      startRecording: jasmine.createSpy(),
    };
    const videos = {listForStream: jasmine.createSpy().and.returnValue(of([])),
      delete: jasmine.createSpy().and.returnValue(of(undefined))};
    TestBed.configureTestingModule({
      imports: [RecordingControlsComponent],
      providers: [{provide: MediaService, useValue: media}, {provide: VideoService, useValue: videos}],
    });
    const fixture = TestBed.createComponent(RecordingControlsComponent);
    fixture.componentRef.setInput('streamUuid', 'stream');
    fixture.componentRef.setInput('live', true);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, media, videos, updates};
  }

  it('keeps the panel out of the lobby and waits for finalization before opening settings once', () => {
    const {fixture, component, updates} = setup();
    const stopped = jasmine.createSpy();
    component.recordingStopped.subscribe(stopped);
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    expect(component.panel).toBeDefined();
    component.toggleRecording();
    updates.next(recording('finalizing'));
    expect(stopped).not.toHaveBeenCalled();
    updates.next(recording('ready'));
    expect(stopped).toHaveBeenCalledTimes(1);
    updates.next(recording('ready'));
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('does not poll recording status while mounted', () => {
    const {fixture, component, media} = setup();
    const stopped = jasmine.createSpy();
    component.recordingStopped.subscribe(stopped);
    fixture.detectChanges();
    expect(media.getRecording).toHaveBeenCalledTimes(1);
    expect(stopped).not.toHaveBeenCalled();
  });

  it('shows a failed stop through the settings error event without reporting completion', () => {
    const {component, media, updates} = setup();
    media.stopRecording.and.returnValue(throwError(() => ({error: {message: 'Stop failed'}})));
    const stopped = jasmine.createSpy();
    const failed = jasmine.createSpy();
    component.recordingStopped.subscribe(stopped);
    component.actionFailed.subscribe(failed);
    component.toggleRecording();
    expect(component.error).toBe('Stop failed');
    expect(component.busy).toBeFalse();
    expect(failed).toHaveBeenCalledTimes(1);
    updates.next(recording('ready'));
    expect(stopped).not.toHaveBeenCalled();
  });

  it('lists numbered replays with status and metadata, without publication controls', () => {
    const {fixture, videos} = setup();
    videos.listForStream.and.returnValue(of([
      {uuid: 'second', title: 'Failed capture', status: 'failed', durationMs: 0,
        createdAt: '2026-11-01T12:00:00', error: 'Source rendition changed during recording'},
      {uuid: 'first', title: 'Completed capture', status: 'ready', durationMs: 23000,
        createdAt: '2026-11-01T11:00:00', error: null},
    ] as RecordedVideo[]));
    fixture.componentRef.setInput('embedded', false);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const items = root.querySelectorAll('.replay-item');
    expect(root.querySelector('h3')?.textContent).toBe('Replays');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Replay 1');
    expect(items[0].textContent).toContain('Completed capture');
    expect(items[0].querySelector('.bi-check-circle')).not.toBeNull();
    expect(items[0].textContent).toContain('0:23');
    expect(items[1].textContent).toContain('Replay 2');
    expect(items[1].textContent).toContain('Recording failed');
    expect(items[1].textContent).not.toContain('0:00');
    expect(items[1].querySelector('details')?.hasAttribute('open')).toBeFalse();
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    expect(root.textContent).not.toContain('Publish');
  });

  it('requires confirmation for deletion and refuses active recordings', () => {
    const {component, videos, media} = setup();
    const video = {uuid: 'ready', status: 'ready'} as RecordedVideo;
    component.deleteReplay(video);
    expect(videos.delete).not.toHaveBeenCalled();
    component.pendingDeleteUuid = video.uuid;
    component.deleteReplay({...video, status: 'recording'});
    expect(videos.delete).not.toHaveBeenCalled();
    media.getRecording.and.returnValue(of(recording('empty')));
    component.deleteReplay(video);
    expect(videos.delete).toHaveBeenCalledWith('ready');
    expect(component.pendingDeleteUuid).toBe('');
  });

  it('emits a replay navigation request for the host application to guard', () => {
    const {fixture, component, videos} = setup();
    videos.listForStream.and.returnValue(of([{uuid: 'ready', title: 'Replay', status: 'ready',
      durationMs: 2000, createdAt: '2026-11-01T12:00:00'}] as RecordedVideo[]));
    const open = jasmine.createSpy('open');
    component.replayOpen.subscribe(open);
    fixture.componentRef.setInput('embedded', false);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.replay-actions .btn-link').click();
    expect(open).toHaveBeenCalledWith('ready');
    expect(videos.delete).not.toHaveBeenCalled();
  });
});
