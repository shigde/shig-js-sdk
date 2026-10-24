import {
  AfterViewInit,
  Component,
  ChangeDetectorRef,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
  TemplateRef
} from '@angular/core';

import {Location} from '@angular/common';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {SkipLoading} from '../../interceptors/loading.interceptor';
import {HttpErrorResponse} from '@angular/common/http';
import {BehaviorSubject, catchError, distinctUntilChanged, EMPTY, filter, lastValueFrom, map, of, switchMap, take, tap, timeout} from 'rxjs';
import {environment} from '../../../environments/environment';

import {
  createLogger,
  LobbyService,
  MediaDeviceManager,
  ParameterService,
  PeerTubeService,
  RelayService,
  PollingService,
  SessionService,
  StreamService,
} from '../../provider';

import {LobbyErrorEvent, LobbyMediaPurpose, LobbyMediaStream, Stream, StreamLiveData} from '../../entities';
import {StreamLayoutEditorComponent} from "../stream-layout-editor/stream-layout-editor.component";
import {StreamMixerService} from "../../provider/stream-mixer.service";

@Component({
  selector: 'shig-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: [
    './../../../../assets/scss/lobby.scss',
    './../../../../assets/scss/styles.scss',
    './lobby.component.scss'
  ],
  encapsulation: ViewEncapsulation.None,
  standalone: false
})
export class LobbyComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  private readonly log = createLogger('LobbyComponent');

  private videoStreamRef?: ElementRef<HTMLVideoElement>;
  private remoteMixedStream?: MediaStream;
  remoteVideoPlaying = false;
  @ViewChild('videoStreamElement') set remoteVideo(ref: ElementRef<HTMLVideoElement> | undefined) {
    if (ref?.nativeElement !== this.videoStreamRef?.nativeElement) this.remoteVideoPlaying = false;
    this.videoStreamRef = ref;
    if (ref && this.remoteMixedStream && this.hostPresent) ref.nativeElement.srcObject = this.remoteMixedStream;
  }
  @ViewChild(StreamLayoutEditorComponent)
  streamLayoutEditor?: StreamLayoutEditorComponent;
  readonly getStreamLayoutEditor = () => this.streamLayoutEditor;

  isInLobby = false;
  isJoining = false;
  isDeviceLoading = false;
  hostPresent = false;
  lobbyNotice = '';
  private readonly presencePolling$ = new BehaviorSubject(true);
  private destroyed = false;
  private joiningTask?: Promise<unknown>;
  private leavingTask?: Promise<void>;
  @Input() setupPreview?: TemplateRef<any>;

  get connectionActive(): boolean { return this.isInLobby || this.isJoining; }
  state: 'offline' | 'online' = 'offline';

  stream: Stream | undefined;
  localGuest: LobbyMediaStream | undefined;
  localGuest$ = new BehaviorSubject<LobbyMediaStream | undefined>(undefined);
  hasMediaStreamSet$ = new BehaviorSubject(false);
  displaySettings$ = new BehaviorSubject(false);

  isHost: boolean = false;

  private streamLiveData: StreamLiveData | undefined;

  private readonly config: RTCConfiguration = {
    bundlePolicy: "max-bundle",
    iceServers: environment.iceServers
  };

  private viewReady = false;
  private initialized = false;
  private deviceChange: Promise<void> = Promise.resolve();
  @Input() token: string | undefined;
  @Input('apiPrefix') apiPrefix: string | undefined;
  @Input('streamUuid') streamUuid: string | undefined;
  @Input('channelUuid') channelUuid: string | undefined;
  @Input('userUuid') userUuid: string | undefined | null;
  @Input('basePath') basePath: string | undefined;

  @Input() role: string | null = 'guest';

  @Output() loadComp = new EventEmitter();
  @Output() onError = new EventEmitter<LobbyErrorEvent>();

  constructor(
    private session: SessionService,
    private devices: MediaDeviceManager,
    private streamService: StreamService,
    private lobbyService: LobbyService,
    private mixer: StreamMixerService,
    private params: ParameterService,
    private location: Location,
    private relay: RelayService,
    private polling: PollingService,
    private destroyRef: DestroyRef,
    private cdr: ChangeDetectorRef,
  ) {
  }

  async ngOnInit() {
    if (this.basePath === undefined) {
      this.basePath = './assets';
    }

    if (this.apiPrefix !== undefined) {
      this.params.API_PREFIX = this.apiPrefix;
    }

    this.session.setAuthenticationToken(this.getToken());

    setTimeout(() => {
      this.loadComp.emit('Component loaded successfully!');
    }, 100);
  }

  ngOnChanges() {
    if (
      !!this.streamUuid &&
      !!this.userUuid &&
      !!this.token &&
      !!this.apiPrefix
    ) {
      if (this.initialized) return;
      this.initStream(this.streamUuid);
    }
  }

  async ngAfterViewInit() {
    await this.startCamera();
  }

  private initStream(streamUuid:string) {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.log.info("Load Stream", this.streamUuid);
    this.streamService.getStream(streamUuid)
      .pipe(
        take(1),
        tap((resp) => this.stream = resp.data),
        tap((s) => {
          this.log.info("Stream Owner:", s.data.ownerUuid, "user uuid:", this.userUuid);
          this.isHost = s.data.ownerUuid === this.userUuid;
          this.watchHostPresence();
          this.relay.pollHasAnnouncement(s.data.channelUuid, s.data.uuid)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(live => {
              this.state = live ? 'online' : 'offline';
              this.cdr.markForCheck();
            });
        }),
        catchError((err, caught)=> {
          this.log.warn("Could not load stream", err);
          this.onError.emit(LobbyErrorEvent.NO_STREAM_PERMISSIONS);
          return of(null)
        }),
      ).subscribe();
  }

  private watchHostPresence(): void {
    this.lobbyService.hostStatus$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(status => {
        if (!status || this.destroyed) return;
        this.hostPresent = status === 'present';
        if (!this.isHost && status !== 'present') this.resetRemoteVideo();
        if (status === 'closed' && this.connectionActive) {
          this.lobbyNotice = 'The lobby has closed. Waiting for host.';
          void this.leaveCurrentLobby(false).catch(error => this.log.warn('Could not close lobby connections', error));
        } else if (status === 'present') {
          this.lobbyNotice = '';
          if (this.videoStreamRef && this.remoteMixedStream && this.videoStreamRef.nativeElement.srcObject !== this.remoteMixedStream) {
            this.videoStreamRef.nativeElement.srcObject = this.remoteMixedStream;
          }
        }
        this.cdr.markForCheck();
      });

    this.presencePolling$.pipe(
      distinctUntilChanged(),
      switchMap(enabled => enabled && !this.isHost
        ? this.polling.watch({
            key: `host-presence:${this.channelUuid}:${this.streamUuid}`,
            intervalMs: 5000,
            batch: {resource: 'host-presence', channelUuid: this.channelUuid!, streamUuid: this.streamUuid!},
            load: context => this.lobbyService.hostPresence(this.channelUuid!, this.streamUuid!, context.get(SkipLoading)).pipe(timeout(8000)),
          }).pipe(
            filter(state => !state.loading),
            map(state => state.error ? false : state.data?.data ?? false),
          )
        : EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(present => {
      this.hostPresent = present;
      if (present) this.lobbyNotice = '';
      this.cdr.markForCheck();
    });
  }

  // getStreamLiveData(): void {
  //   if (this.streamUuid !== undefined && this.token !== undefined) {
  //     this.peerTubeService.fetchStreamLiveData(this.token, this.streamUuid)
  //       .pipe(tap((data) => this.streamLiveData = data))
  //       .subscribe(() => {
  //       });
  //   }
  // }

  startCamera(): Promise<void> {
    this.deviceChange = this.deviceChange.then(() => this.updateCamera());
    return this.deviceChange;
  }

  private async updateCamera(): Promise<void> {
    if (this.destroyed) return;
    this.isDeviceLoading = true;
    let stream: MediaStream | undefined;
    const previous = this.localGuest?.stream;
    try {
      stream = await this.devices.sartDevice();
      if (this.destroyed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      stream.getTracks().forEach(track => {
        const oldTrack = previous?.getTracks().find(old => old.kind === track.kind);
        if (oldTrack) track.enabled = oldTrack.enabled;
      });
      await this.lobbyService.replaceGuestStream(stream);
      if (this.destroyed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.hasMediaStreamSet$.next(true);
      this.localGuest = LobbyMediaStream.buildLocal('me', stream);
      this.localGuest$.next(this.localGuest);
      previous?.getTracks().forEach(track => track.stop());
    } catch (e) {
      stream?.getTracks().forEach(track => track.stop());
      this.log.error('Could not start camera or Mixer', e);
      this.hasMediaStreamSet$.next(!!previous);
      this.displaySettings$.next(true);
    } finally {
      this.isDeviceLoading = false;
      if (!this.destroyed) this.cdr.markForCheck();
    }
  }

  goBack(): void {
    this.location.back();
  }

  join(): void {
    if (this.connectionActive || this.isDeviceLoading || this.leavingTask || (!this.isHost && !this.hostPresent)) return;
    if (!!this.stream && !!this.localGuest?.stream && this.streamUuid !== undefined && this.channelUuid !== undefined) {
      const streams: Map<LobbyMediaPurpose, MediaStream> = new Map<LobbyMediaPurpose, MediaStream>();
      streams.set(LobbyMediaPurpose.GUEST, this.localGuest.stream);

      if (this.isHost && !!this.mixer) {
        streams.set(LobbyMediaPurpose.STREAM, this.mixer.getMixedStream());
      }

      this.isJoining = true;
      this.lobbyNotice = '';
      this.presencePolling$.next(false);
      this.joiningTask = lastValueFrom(this.session.getUserName().pipe(take(1)))
        .then(name => this.lobbyService.join(streams, this.channelUuid!, this.streamUuid!, this.config, name || 'Guest'))
          .then(() => { if (!this.destroyed) this.isInLobby = true; })
          .catch((error) => {
            this.log.error('Could not join lobby', error);
            this.isInLobby = false;

            let reason = error.error?.message;
            if (typeof error.error === 'string') {
              try { reason = JSON.parse(error.error).message; } catch { /* Non-JSON HTTP error. */ }
            }
            if (error instanceof HttpErrorResponse && error.status === 409 && reason === 'Waiting for host') {
              this.hostPresent = false;
            } else if (
              (error instanceof HttpErrorResponse && error.status === 409) ||
              error?.message === 'Lobby connection already exists. Leave the lobby before joining again.'
            ) {
              this.onError.emit(LobbyErrorEvent.LOBBY_CONNECTION_EXISTS);
            } else {
              this.onError.emit(LobbyErrorEvent.LOBBY_JOIN_FAILED);
            }
          })
          .finally(() => {
            this.isJoining = false;
            if (!this.isInLobby && !this.destroyed) this.presencePolling$.next(true);
            if (!this.destroyed) this.cdr.markForCheck();
          });
    }
  }

  addLobbyMediaStream(media: LobbyMediaStream): void {
    if (!!this.mixer && media.purpose === LobbyMediaPurpose.GUEST && !!media.stream) {
      const videoId = `video-${media.streamId}`;
      this.mixer.appendStream(videoId, media.name || 'Guest');
    }
    if (!this.isHost && media.purpose === LobbyMediaPurpose.STREAM && !!media.stream) {
      if (this.remoteMixedStream !== media.stream) this.remoteVideoPlaying = false;
      this.remoteMixedStream = media.stream;
      if (this.videoStreamRef && this.hostPresent) this.videoStreamRef.nativeElement.srcObject = media.stream;
    }
  }

  removeLobbyMediaStream(media: LobbyMediaStream): void {
    if (media.purpose === LobbyMediaPurpose.STREAM && media.streamId === this.remoteMixedStream?.id) {
      this.remoteMixedStream = undefined;
      this.resetRemoteVideo();
    }
    if (!!this.mixer && media.purpose === LobbyMediaPurpose.GUEST && !!media.stream) {
      const videoId = `video-${media.streamId}`
      this.mixer.removeStream(videoId);
    }
  }

  private getToken(): string {
    if (typeof this.token !== 'string') {
      this.log.warn('Invalid token: ', this.token);
    }
    return (this.token === undefined) ? 'unauthorized' : this.token;
  }

  private resetRemoteVideo(): void {
    this.remoteVideoPlaying = false;
    const video = this.videoStreamRef?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.load();
    }
  }

  toggleSettings() {
    if (this.isDeviceLoading || this.isJoining) return;
    let current = this.displaySettings$.getValue();
    this.displaySettings$.next(!current);
  }

  closeSettings() {
    this.displaySettings$.next(false);
  }

  async onDeviceSelect() {
    this.log.info('device settings');
    await this.startCamera();
  }

  toggleActive(videoId: string, checkboxId: string) {
    const shadowRoot = document.getElementById(checkboxId)?.shadowRoot;
    const isSelected = !shadowRoot?.querySelector('div')?.classList.contains('selected');
    this.mixer.toggleActive(isSelected, videoId);
  }

  start(): void {
    this.log.info('start', this.streamUuid, this.channelUuid);
    if (this.streamUuid != undefined && this.channelUuid != undefined) {
      this.lobbyService.startLiveStream(this.channelUuid, this.streamUuid)
        .subscribe(() => {
          this.state = 'online';
        });
    }
  }

  stop(): void {
    if (this.streamUuid != undefined && this.channelUuid != undefined) {
      this.lobbyService.stopLiveStream(this.channelUuid, this.streamUuid).subscribe(() => {
        this.state = 'offline';
      });
    }
  }

  leaveLobby(): void {
    void this.leaveCurrentLobby().then(() => window.location.reload());
  }

  leaveCurrentLobby(notifyServer = true): Promise<void> {
    if (this.leavingTask) return this.leavingTask;
    const wasActive = this.connectionActive;
    this.leavingTask = (async () => {
      await this.joiningTask;
      try {
        if (notifyServer && wasActive && this.streamUuid && this.channelUuid) {
          await lastValueFrom(this.lobbyService.leaveLobby(this.channelUuid, this.streamUuid));
        }
      } finally {
        await this.lobbyService.closeConnections();
        this.isInLobby = false;
        if (!this.destroyed) this.presencePolling$.next(true);
        this.remoteMixedStream = undefined;
        this.resetRemoteVideo();
        if (!this.destroyed) this.cdr.markForCheck();
      }
    })().finally(() => this.leavingTask = undefined);
    return this.leavingTask;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.presencePolling$.next(false);
    void this.leaveCurrentLobby().catch(error => this.log.warn('Could not leave lobby', error));
    this.localGuest?.stream?.getTracks().forEach(track => track.stop());
  }
}
