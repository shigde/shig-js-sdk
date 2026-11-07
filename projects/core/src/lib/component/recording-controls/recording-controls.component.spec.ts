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

  function setup(automatic = false) {
    const updates = new Subject<MediaRecording>();
    const media = {
      getRecording: jasmine.createSpy().and.returnValue(of(recording('recording'))),
      stopRecording: jasmine.createSpy().and.returnValue(updates),
      startRecording: jasmine.createSpy().and.returnValue(updates),
    };
    const videos = {listForStream: jasmine.createSpy().and.returnValue(of([])),
      delete: jasmine.createSpy().and.returnValue(of(undefined)),
      waitForRecordingReady: jasmine.createSpy().and.returnValue(of(undefined))};
    TestBed.configureTestingModule({
      imports: [RecordingControlsComponent],
      providers: [{provide: MediaService, useValue: media}, {provide: VideoService, useValue: videos}],
    });
    const fixture = TestBed.createComponent(RecordingControlsComponent);
    fixture.componentRef.setInput('streamUuid', 'stream');
    fixture.componentRef.setInput('live', true);
    fixture.componentRef.setInput('embedded', true);
    fixture.componentRef.setInput('automatic', automatic);
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

  it('reports a replay once when stopping the live stream completes its recording', () => {
    const {fixture, component, media} = setup(true);
    const stopped = jasmine.createSpy();
    component.recordingStopped.subscribe(stopped);
    media.getRecording.and.returnValue(of(recording('ready')));

    fixture.componentRef.setInput('live', false);
    fixture.detectChanges();
    expect(stopped).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('userUuid', 'owner');
    fixture.detectChanges();
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it('starts and stops separate replays from the automatic lobby controls', () => {
    const {component, media, videos} = setup(true);

    media.startRecording.and.returnValues(
      of({...recording('recording'), videoUuid: 'first-replay'}),
      of({...recording('recording'), videoUuid: 'second-replay'}),
    );
    media.stopRecording.and.returnValue(of({...recording('ready'), videoUuid: 'first-replay'}));
    component.recording = recording('empty');

    expect(component.canToggleRecording).toBeTrue();
    component.toggleRecording();
    component.toggleRecording();
    component.toggleRecording();

    expect(videos.waitForRecordingReady).not.toHaveBeenCalled();
    expect(media.startRecording).toHaveBeenCalledTimes(2);
    expect(media.stopRecording).toHaveBeenCalledOnceWith('first-replay');
    expect(component.recording?.videoUuid).toBe('second-replay');
  });

  it('waits for source readiness without starting a recording or emitting menu events', () => {
    const {fixture, component, media, videos, updates} = setup();
    const ready = new Subject<void>();
    videos.waitForRecordingReady.and.returnValue(ready);
    media.getRecording.and.returnValue(of(recording('empty')));
    fixture.componentRef.setInput('live', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('live', true);
    fixture.detectChanges();
    expect(component.preparing).toBeTrue();
    expect(component.canToggleRecording).toBeFalse();
    component.toggleRecording();
    expect(media.startRecording).not.toHaveBeenCalled();
    ready.next();
    expect(component.canToggleRecording).toBeTrue();
    const stopped = jasmine.createSpy();
    component.recordingStopped.subscribe(stopped);
    component.toggleRecording();
    expect(media.startRecording).toHaveBeenCalledWith('stream');
    updates.next(recording('recording'));
    expect(stopped).not.toHaveBeenCalled();
  });

  it('cancels readiness when the stream goes offline and allows an explicit retry after failure', () => {
    const {fixture, component, media, videos} = setup();
    const ready = new Subject<void>();
    videos.waitForRecordingReady.and.returnValue(ready);
    media.getRecording.and.returnValue(of(recording('empty')));
    fixture.componentRef.setInput('live', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('live', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('live', false);
    fixture.detectChanges();
    ready.next();
    expect(component.recordingReady).toBeFalse();
    videos.waitForRecordingReady.and.returnValue(throwError(() => new Error('not ready')));
    fixture.componentRef.setInput('live', true);
    fixture.detectChanges();
    expect(component.preparationError).not.toBe('');
    videos.waitForRecordingReady.and.returnValue(of(undefined));
    component.toggleRecording();
    expect(component.recordingReady).toBeTrue();
    expect(media.startRecording).not.toHaveBeenCalled();
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
