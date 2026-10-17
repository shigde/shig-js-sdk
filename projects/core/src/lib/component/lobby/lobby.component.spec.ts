import {of} from 'rxjs';
import {LobbyComponent} from './lobby.component';
import {LobbyMediaPurpose, LobbyMediaStream, Stream} from '../../entities';

describe('Lobby setup and joining', () => {
  let component: LobbyComponent;
  let join: jasmine.Spy;
  let mixed: jasmine.Spy;
  let close: jasmine.Spy;

  beforeEach(() => {
    join = jasmine.createSpy('join').and.resolveTo();
    mixed = jasmine.createSpy('getMixedStream').and.returnValue(new MediaStream());
    close = jasmine.createSpy('closeConnections').and.resolveTo();
    component = new LobbyComponent(
      {getUserName: () => of('Guest')} as any,
      {} as any, {} as any,
      {join, closeConnections: close, leaveLobby: () => of(null)} as any,
      {getMixedStream: mixed} as any,
      {} as any, {} as any, {} as any, {} as any,
      {markForCheck: () => {}} as any,
    );
    component.stream = {uuid: 'stream'} as Stream;
    component.streamUuid = 'stream';
    component.channelUuid = 'channel';
    component.localGuest = LobbyMediaStream.buildLocal('me', new MediaStream());
  });

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
});
