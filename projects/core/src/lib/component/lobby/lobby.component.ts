import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';

import {Location} from '@angular/common';
import {BehaviorSubject, tap} from 'rxjs';
import {environment} from '../../../environments/environment';
import {DeviceSettingsCbk} from '../';

import {
    DeviceSettingsService,
    LobbyService,
    ParameterService,
    PeerTubeService,
    SessionService,
    CanvasStreamMixer,
    StreamService,
} from '../../provider';

import {
    DeviceSettings,
    Stream,
    StreamLiveData,
    LobbyMediaType, Guest, User, buildGuest
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
    cbk: DeviceSettingsCbk;
    displaySettings = false;
    isInLobby = false;
    state: 'offline' | 'online' = 'offline';

    stream: Stream | undefined;
    localGuest: Guest | undefined;
    localGuest$ = new BehaviorSubject<Guest | undefined>(undefined);
    hasMediaStreamSet = false;

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
                    if (this.user !== undefined && this.stream?.user === this.user) {
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
                this.localGuest = buildGuest('local', 'me', stream);
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
            const streams: Map<LobbyMediaType, MediaStream> = new Map<LobbyMediaType, MediaStream>();
            streams.set(LobbyMediaType.GUEST, this.localGuest.stream);

            if (!!this.mixer) {
                streams.set(LobbyMediaType.STREAM, this.mixer.getMixedStream());
            }

            this.lobbyService.join(streams, this.spaceId, this.streamId, this.config).then(() => this.isInLobby = true);
        }
    }

    addGuest(guest: Guest): void {
        if (!!this.mixer) {
            const videoId = `video-${guest?.stream?.id}`;
            this.mixer.appendStream(guest.stream);
            this.mixer?.videoElements.set(videoId, document.getElementById(videoId) as HTMLVideoElement);
        }
    }

    removeGuest(guest: Guest): void {
        if (!!this.mixer) {
            this.mixer.removeStream(guest.stream);
            const videoId = `video-${guest?.stream?.id}`;
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
}
