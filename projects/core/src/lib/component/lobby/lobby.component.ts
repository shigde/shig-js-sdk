import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';

import {Location} from '@angular/common';
import {BehaviorSubject, catchError, of, take, tap} from 'rxjs';
import {environment} from '../../../environments/environment';

import {
  createLogger,
  LobbyService,
  MediaDeviceManager,
  ParameterService,
  PeerTubeService,
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
export class LobbyComponent implements OnInit, AfterViewInit, OnChanges {
  private readonly log = createLogger('LobbyComponent');

  @ViewChild('videoStreamElement') videoStreamRef!: ElementRef<HTMLVideoElement>;
  @ViewChild(StreamLayoutEditorComponent)
  private streamLayoutEditor?: StreamLayoutEditorComponent;

  isInLobby = false;
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
          this.isHost = s.data.ownerUuid === this.userUuid
        }),
        catchError((err, caught)=> {
          this.log.warn("Could not load stream", err);
          this.onError.emit(LobbyErrorEvent.NO_STREAM_PERMISSIONS);
          return of(null)
        }),
      ).subscribe();
  }

  // getStreamLiveData(): void {
  //   if (this.streamUuid !== undefined && this.token !== undefined) {
  //     this.peerTubeService.fetchStreamLiveData(this.token, this.streamUuid)
  //       .pipe(tap((data) => this.streamLiveData = data))
  //       .subscribe(() => {
  //       });
  //   }
  // }

  async startCamera() {
    try {
      let stream = await this.devices.sartDevice();
      this.hasMediaStreamSet$.next(true);
      if (this.localGuest?.stream) {
        this.localGuest?.stream.getTracks().forEach(t => {
          t.stop();
        });
      }
      this.localGuest = LobbyMediaStream.buildLocal('me', stream);
      this.localGuest$.next(this.localGuest);
    } catch (e) {
      this.log.error('Could not start camera or Mixer', e);
      this.hasMediaStreamSet$.next(false);
      this.displaySettings$.next(true);
    }
  }

  goBack(): void {
    if (this.localGuest?.stream) {
      this.localGuest.stream.getTracks().forEach(t => t.stop());
      this.localGuest = undefined;
    }
    this.location.back();
  }

  join(): void {
    if (!!this.stream && !!this.localGuest?.stream && this.streamUuid !== undefined && this.channelUuid !== undefined) {
      const streams: Map<LobbyMediaPurpose, MediaStream> = new Map<LobbyMediaPurpose, MediaStream>();
      streams.set(LobbyMediaPurpose.GUEST, this.localGuest.stream);

      if (!!this.mixer) {
        streams.set(LobbyMediaPurpose.STREAM, this.mixer.getMixedStream());
      }

      this.lobbyService.join(streams, this.channelUuid, this.streamUuid, this.config, 'Guest').then(() => this.isInLobby = true);
    }
  }

  addLobbyMediaStream(media: LobbyMediaStream): void {
    if (!!this.mixer && media.purpose === LobbyMediaPurpose.GUEST && !!media.stream) {
      const videoId = `video-${media.streamId}`;
      this.mixer.appendStream(videoId);
    }
    if (!this.isHost && media.purpose === LobbyMediaPurpose.STREAM && !!media.stream) {
      this.getStreamVideoElement().srcObject = media.stream;
    }
  }

  removeLobbyMediaStream(media: LobbyMediaStream): void {
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

  toggleSettings() {
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
    if (this.streamUuid != undefined && this.channelUuid != undefined) {
      this.lobbyService.leaveLobby(this.channelUuid, this.streamUuid).subscribe(() => {
        window.location.reload();
      });
    }
  }

  private getStreamVideoElement(): HTMLVideoElement {
    return this.videoStreamRef.nativeElement;
  }
}
