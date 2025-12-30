import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation} from '@angular/core';

import {Location} from '@angular/common';
import {BehaviorSubject, tap} from 'rxjs';
import {environment} from '../../../environments/environment';

import {
  CanvasStreamMixer, createLogger,
  DeviceSettingsService,
  LobbyService,
  ParameterService,
  PeerTubeService,
  SessionService,
  StreamService,
} from '../../provider';

import {
  DeviceSettings,
  LobbyMediaPurpose,
  LobbyMediaStream,
  Stream,
  StreamLiveData
} from '../../entities';

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
export class LobbyComponent implements OnInit {
  private readonly log = createLogger('LobbyComponent');

  @ViewChild('videoStreamElement') videoStreamRef!: ElementRef<HTMLVideoElement>;

  isInLobby = false;
  state: 'offline' | 'online' = 'offline';

  stream: Stream | undefined;
  localGuest: LobbyMediaStream | undefined;
  localGuest$ = new BehaviorSubject<LobbyMediaStream | undefined>(undefined);
  hasMediaStreamSet = false;
  displaySettings = true;
  isHost = false;

  private streamLiveData: StreamLiveData | undefined;
  private mixer?: CanvasStreamMixer;

  private readonly config: RTCConfiguration = {
    bundlePolicy: "max-bundle",
    iceServers: environment.iceServers
  };

  @Input() token: string | undefined;
  @Input('apiPrefix') apiPrefix: string | undefined;
  @Input('streamUuid') streamUuid: string | undefined;
  @Input('channelUuid') channelUuid: string | undefined;
  @Input('userUuid') userUuid: string | undefined;
  @Input('basePath') basePath: string | undefined;

  @Input() role: string | null = 'guest';

  @Output() loadComp = new EventEmitter();

  private image: HTMLImageElement = new Image;

  constructor(
    private session: SessionService,
    private devices: DeviceSettingsService,
    private streamService: StreamService,
    private lobbyService: LobbyService,
    private peerTubeService: PeerTubeService,
    private params: ParameterService,
    private location: Location
  ) {

  }

  ngOnInit(): void {
    if (this.apiPrefix !== undefined) {
      this.params.API_PREFIX = this.apiPrefix;
    }
    if (this.basePath === undefined) {
      this.basePath = './assets';
    }


    this.image.src = this.basePath + '/images/face.svg';
    this.image.onload =  () => {
      this.log.info('image loaded');
    };

    this.session.setAuthenticationToken(this.getToken());
    this.getStream();
    this.getStreamLiveData();

    setTimeout(() => {
      this.loadComp.emit('Component loaded successfully!');
    }, 100);
  }

  getStream(): void {
    if (this.streamUuid !== undefined) {
      this.streamService.getStream(this.streamUuid)
        .pipe(tap((resp) => this.stream = resp.data))
        .subscribe(() => {
          this.isHost = this.userUuid !== undefined && this.stream?.ownerUuid === this.userUuid;
          if (this.isHost) {
            setTimeout(() => {
              this.mixer = new CanvasStreamMixer('canvasOne', this.image);
              this.mixer.start();
            }, 0);
          }
        });
    }
  }

  getStreamLiveData(): void {
    if (this.streamUuid !== undefined && this.token !== undefined) {
      this.peerTubeService.fetchStreamLiveData(this.token, this.streamUuid)
        .pipe(tap((data) => this.streamLiveData = data))
        .subscribe(() => {
        });
    }
  }

  startCamera(settings: DeviceSettings) {
    this.devices.getUserMedia(settings)
      .then((stream: any) => {
        if (this.localGuest?.stream) {
          this.localGuest?.stream.getTracks().forEach(t => {
            t.stop();
          });
        }
        this.localGuest = LobbyMediaStream.buildLocal('me', stream);
        this.localGuest$.next(this.localGuest);
      })
      .then(() => {
          if (this.localGuest?.stream) {
            this.hasMediaStreamSet = true;
            if (!!this.mixer) {
              this.mixer.appendStream(this.localGuest.stream);
            }
          }
        }
      );
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
      this.mixer.appendStream(media.stream);
      this.mixer?.videoElements.set(videoId, document.getElementById(videoId) as HTMLVideoElement);
    }
    if (!this.isHost && media.purpose === LobbyMediaPurpose.STREAM && !!media.stream) {
      this.getStreamVideoElement().srcObject = media.stream;
    }
  }

  removeLobbyMediaStream(media: LobbyMediaStream): void {
    if (!!this.mixer && media.purpose === LobbyMediaPurpose.GUEST && !!media.stream) {
      this.mixer.removeStream(media.stream);
      const videoId = `video-${media.streamId}`;
      this.mixer?.videoElements.delete(videoId);
    }
  }

  private getToken(): string {
    if (typeof this.token !== 'string') {
      this.log.warn('Invalid token: ', this.token);
    }
    return (this.token === undefined) ? 'unauthorized' : this.token;
  }

  toggleSettings() {
    this.displaySettings = !this.displaySettings;
  }

  onDeviceSelect(settings: DeviceSettings) {
    this.log.info('device settings', settings);
    this.startCamera(settings);
  }

  toggleActive(videoId: string, checkboxId: string) {
    const shadowRoot = document.getElementById(checkboxId)?.shadowRoot;
    const isSelected = !shadowRoot?.querySelector('div')?.classList.contains('selected');

    if (isSelected) {
      this.mixer?.videoElements.set(videoId, document.getElementById(videoId) as HTMLVideoElement);
    } else {
      this.mixer?.videoElements.delete(videoId);
    }
  }

  start(): void {
    this.log.info('start', this.streamLiveData, this.streamUuid, this.channelUuid);
    if (this.streamLiveData != undefined && this.streamUuid != undefined && this.channelUuid != undefined) {
      this.lobbyService.startLiveStream(this.streamLiveData, this.channelUuid, this.streamUuid)
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
