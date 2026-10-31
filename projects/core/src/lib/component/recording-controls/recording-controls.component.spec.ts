import {TestBed} from '@angular/core/testing';
import {of, Subject, throwError} from 'rxjs';
import {MediaRecording} from '../../entities/media-recording';
import {MediaService} from '../../provider/media.service';
import {RecordingControlsComponent} from './recording-controls.component';

describe('Lobby recording completion', () => {
  const recording = (status: MediaRecording['status']): MediaRecording => ({
    streamUuid: 'stream', status, published: false, durationMs: 12000,
  });

  function setup() {
    const updates = new Subject<MediaRecording>();
    const media = {
      getRecording: jasmine.createSpy().and.returnValue(of(recording('recording'))),
      stopRecording: jasmine.createSpy().and.returnValue(updates),
      startRecording: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({
      imports: [RecordingControlsComponent],
      providers: [{provide: MediaService, useValue: media}],
    });
    const fixture = TestBed.createComponent(RecordingControlsComponent);
    fixture.componentRef.setInput('streamUuid', 'stream');
    fixture.componentRef.setInput('live', true);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, media, updates};
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
});
