import {BehaviorSubject, of} from 'rxjs';
import {fakeAsync, flushMicrotasks, tick} from '@angular/core/testing';
import {HttpErrorResponse} from '@angular/common/http';
import {LobbyComponent} from './lobby.component';
import {HostStatus, LobbyMediaPurpose, LobbyMediaStream, Stream} from '../../entities';

describe('Lobby setup and joining', () => {
  let component: LobbyComponent;
  let join: jasmine.Spy;
  let mixed: jasmine.Spy;
  let close: jasmine.Spy;
  let presence: jasmine.Spy;
  let status: BehaviorSubject<HostStatus | null>;
  let destroyCallbacks: (() => void)[];

  beforeEach(() => {
    join = jasmine.createSpy('join').and.resolveTo();
    mixed = jasmine.createSpy('getMixedStream').and.returnValue(new MediaStream());
    close = jasmine.createSpy('closeConnections').and.resolveTo();
    presence = jasmine.createSpy('hostPresence').and.returnValue(of({data: false}));
    status = new BehaviorSubject<HostStatus | null>(null);
    destroyCallbacks = [];
    component = new LobbyComponent(
      {getUserName: () => of('Guest')} as any,
      {} as any, {} as any,
      {join, closeConnections: close, leaveLobby: () => of(null), hostPresence: presence, hostStatus$: status} as any,
      {getMixedStream: mixed} as any,
      {} as any, {} as any, {} as any,
      {onDestroy: (callback: () => void) => { destroyCallbacks.push(callback); return () => {}; }} as any,
      {markForCheck: () => {}} as any,
    );
    component.stream = {uuid: 'stream'} as Stream;
    component.streamUuid = 'stream';
    component.channelUuid = 'channel';
    component.localGuest = LobbyMediaStream.buildLocal('me', new MediaStream());
    component.hostPresent = true;
  });

  afterEach(() => destroyCallbacks.forEach(callback => callback()));

  it('does not join as a guest before the host is present', () => {
    component.hostPresent = false;
    component.join();
    expect(join).not.toHaveBeenCalled();
    expect(component.isJoining).toBeFalse();
  });

  it('returns to waiting when the host leaves between polling and joining', fakeAsync(() => {
    join.and.rejectWith(new HttpErrorResponse({status: 409, error: '{"message":"Waiting for host"}'}));
    const errors = jasmine.createSpy('onError');
    component.onError.subscribe(errors);
    component.join();
    flushMicrotasks();
    expect(component.hostPresent).toBeFalse();
    expect(component.isInLobby).toBeFalse();
    expect(errors).not.toHaveBeenCalled();
  }));

  it('polls only in setup and resumes after leaving', fakeAsync(() => {
    (component as any).watchHostPresence();
    tick(0);
    expect(component.hostPresent).toBeFalse();
    presence.and.returnValue(of({data: true}));
    tick(5000);
    expect(component.hostPresent).toBeTrue();
    component.join();
    flushMicrotasks();
    tick(10000);
    expect(presence).toHaveBeenCalledTimes(2);
    status.next('waiting');
    expect(component.hostPresent).toBeFalse();
    expect(component.isInLobby).toBeTrue();
    status.next('present');
    expect(component.hostPresent).toBeTrue();
    void component.leaveCurrentLobby();
    flushMicrotasks();
    tick(0);
    expect(presence).toHaveBeenCalledTimes(3);
    destroyCallbacks.forEach(callback => callback());
    destroyCallbacks = [];
  }));

  it('clears the last remote frame when the host disappears and reattaches on recovery', fakeAsync(() => {
    (component as any).watchHostPresence();
    tick(0);
    status.next('present');
    const stream = new MediaStream();
    const video = document.createElement('video');
    const pause = spyOn(video, 'pause');
    const load = spyOn(video, 'load');
    component.addLobbyMediaStream({purpose: LobbyMediaPurpose.STREAM, stream} as LobbyMediaStream);
    component.remoteVideo = {nativeElement: video};
    component.remoteVideoPlaying = true;
    expect(video.srcObject).toBe(stream);
    status.next('waiting');
    expect(video.srcObject).toBeNull();
    expect(component.remoteVideoPlaying).toBeFalse();
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    status.next('present');
    expect(video.srcObject).toBe(stream);
    destroyCallbacks.forEach(callback => callback());
    destroyCallbacks = [];
  }));

  it('closes connections but keeps local capture ready for rejoining', fakeAsync(() => {
    (component as any).watchHostPresence();
    tick(0);
    component.isInLobby = true;
    const stop = jasmine.createSpy('stop');
    component.localGuest = {stream: {getTracks: () => [{stop}]}} as any;
    const localGuest = component.localGuest;
    component.hasMediaStreamSet$.next(true);
    status.next('closed');
    flushMicrotasks();
    tick(0);
    expect(component.isInLobby).toBeFalse();
    expect(close).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(component.localGuest).toBe(localGuest);
    expect(component.hasMediaStreamSet$.value).toBeTrue();
    expect(component.lobbyNotice).toContain('closed');
    presence.and.returnValue(of({data: true}));
    tick(5000);
    component.join();
    flushMicrotasks();
    expect(component.isInLobby).toBeTrue();
    expect(join.calls.mostRecent().args[0].get(LobbyMediaPurpose.GUEST)).toBe(localGuest!.stream);
    expect(stop).not.toHaveBeenCalled();
    destroyCallbacks.forEach(callback => callback());
    destroyCallbacks = [];
  }));

  it('still releases local capture when the component is destroyed', fakeAsync(() => {
    const stop = jasmine.createSpy('stop');
    component.localGuest = {stream: {getTracks: () => [{stop}]}} as any;
    component.ngOnDestroy();
    flushMicrotasks();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalled();
  }));

  it('joins guests without creating a local mixed stream', async () => {
    expect(component.connectionActive).toBeFalse();
    component.join();
    expect(component.isJoining).toBeTrue();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(component.isInLobby).toBeTrue();
    expect(mixed).not.toHaveBeenCalled();
    expect(join.calls.mostRecent().args[0].has(LobbyMediaPurpose.STREAM)).toBeFalse();
    await component.leaveCurrentLobby();
    expect(component.connectionActive).toBeFalse();
    expect(close).toHaveBeenCalled();
  });

  it('includes the local mixer only for the host', async () => {
    component.isHost = true;
    component.join();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(join.calls.mostRecent().args[0].has(LobbyMediaPurpose.STREAM)).toBeTrue();
    await component.leaveCurrentLobby();
  });

  it('attaches an early WebRTC mixed track once the joined video is mounted', () => {
    const stream = new MediaStream();
    component.addLobbyMediaStream({purpose: LobbyMediaPurpose.STREAM, stream} as LobbyMediaStream);
    const video = document.createElement('video');
    component.remoteVideo = {nativeElement: video};
    expect(video.srcObject).toBe(stream);
  });

  it('resets the empty-video state for a new stream and after track removal', () => {
    const stream = new MediaStream();
    component.remoteVideoPlaying = true;
    component.addLobbyMediaStream({purpose: LobbyMediaPurpose.STREAM, stream} as LobbyMediaStream);
    expect(component.remoteVideoPlaying).toBeFalse();
    component.remoteVideoPlaying = true;
    component.addLobbyMediaStream({purpose: LobbyMediaPurpose.STREAM, stream} as LobbyMediaStream);
    expect(component.remoteVideoPlaying).toBeTrue();
    component.removeLobbyMediaStream({purpose: LobbyMediaPurpose.STREAM, streamId: stream.id} as LobbyMediaStream);
    expect(component.remoteVideoPlaying).toBeFalse();
  });
});
