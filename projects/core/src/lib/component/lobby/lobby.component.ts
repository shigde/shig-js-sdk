import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation} from '@angular/core';

import {Location} from '@angular/common';
import {BehaviorSubject, tap} from 'rxjs';
import {environment} from '../../../environments/environment';
import {DeviceSettingsCbk} from '../';

import {
    CanvasStreamMixer,
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
    encapsulation: ViewEncapsulation.None
})
export class LobbyComponent implements OnInit {

    @ViewChild('videoStreamElement') videoStreamRef!: ElementRef<HTMLVideoElement>;

    cbk: DeviceSettingsCbk;
    displaySettings = false;
    isInLobby = false;
    state: 'offline' | 'online' = 'offline';

    stream: Stream | undefined;
    localGuest: LobbyMediaStream | undefined;
    localGuest$ = new BehaviorSubject<LobbyMediaStream | undefined>(undefined);
    hasMediaStreamSet = false;
    isHost = false;

    private streamLiveData: StreamLiveData | undefined;
    private mixer?: CanvasStreamMixer;

    private readonly config: RTCConfiguration = {
        iceServers: environment.iceServers
    };

    @Input() token: string | undefined;
    @Input('api-prefix') apiPrefix: string | undefined;
    @Input('stream') streamId: string | undefined;
    @Input('space') spaceId: string | undefined;
    @Input('user') user: string | undefined;

    @Input() role: string | null = 'guest';

    @Output() loadComp = new EventEmitter();

    constructor(
        private session: SessionService,
        private devices: DeviceSettingsService,
        private streamService: StreamService,
        private lobbyService: LobbyService,
        private peerTubeService: PeerTubeService,
        private params: ParameterService,
        private location: Location
    ) {
        this.cbk = (settings) => {
            this.startCamera(settings);
        };
    }

    ngOnInit(): void {
        if (this.apiPrefix !== undefined) {
            this.params.API_PREFIX = this.apiPrefix;
        }
        this.session.setAuthenticationToken(this.getToken());
        this.getStream();
        this.getStreamLiveData();

        setTimeout(() => {
            this.loadComp.emit('Component loaded successfully!');
        }, 100);
    }

    getStream(): void {
        if (this.streamId !== undefined && this.spaceId !== undefined) {
            this.streamService.getStream(this.streamId, this.spaceId)
                .pipe(tap((stream) => this.stream = stream))
                .subscribe(() => {
                    this.isHost = this.user !== undefined && this.stream?.user === this.user;
                    if (this.isHost) {
                        setTimeout(() => {
                            this.mixer = new CanvasStreamMixer('canvasOne');
                            this.mixer.start();
                        }, 0);
                    }
                });
        }
    }

    getStreamLiveData(): void {
        if (this.streamId !== undefined && this.token !== undefined) {
            this.peerTubeService.fetchStreamLiveData(this.token, this.streamId)
                .pipe(tap((data) => this.streamLiveData = data))
                .subscribe(() => {
                });
        }
    }

    startCamera(settings: DeviceSettings) {
        this.devices.getUserMedia(settings)
            .then((stream: any) => {
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
        if (!!this.stream && !!this.localGuest?.stream && this.streamId !== undefined && this.spaceId !== undefined) {
            const streams: Map<LobbyMediaPurpose, MediaStream> = new Map<LobbyMediaPurpose, MediaStream>();
            streams.set(LobbyMediaPurpose.GUEST, this.localGuest.stream);

            if (!!this.mixer) {
                streams.set(LobbyMediaPurpose.STREAM, this.mixer.getMixedStream());
            }

            this.lobbyService.join(streams, this.spaceId, this.streamId, this.config).then(() => this.isInLobby = true);
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
            console.error('Invalid token: ', this.token);
        }
        return (this.token === undefined) ? 'unauthorized' : this.token;
    }

    toggleSettings() {
        this.displaySettings = !this.displaySettings;
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
        if (this.streamLiveData != undefined && this.streamId != undefined && this.spaceId != undefined) {
            this.lobbyService.startLiveStream(this.streamLiveData, this.spaceId, this.streamId)
                .subscribe(() => {
                    this.state = 'online';
                });
        }
    }

    stop(): void {
        if (this.streamId != undefined && this.spaceId != undefined) {
            this.lobbyService.stopLiveStream(this.spaceId, this.streamId).subscribe(() => {
                this.state = 'offline';
            });
        }
    }

    leaveLobby(): void {
        if (this.streamId != undefined && this.spaceId != undefined) {
            this.lobbyService.leaveLobby(this.spaceId, this.streamId).subscribe(() => {
                window.location.reload()
            });
        }
    }

    private getStreamVideoElement(): HTMLVideoElement {
        return this.videoStreamRef.nativeElement;
    }
}
