import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';

import {Location} from '@angular/common';
import {filter, tap} from 'rxjs';
import {environment} from '../../../environments/environment';
import {DeviceSettingsCbk} from '../';

import {
    DeviceSettingsService,
    LobbyService,
    ParameterService,
    PeerTubeService,
    SessionService,
    StreamMixer,
    StreamService,
} from '../../provider';

import {
    DeviceSettings,
    Stream,
    StreamLiveData,
    MediaStreamType
} from '../../entities';

@Component({
    selector: 'shig-lobby',
    templateUrl: './lobby.component.html',
        styleUrls: [
            './../../../../assets/scss/lobby.scss',
            './../../../../assets/scss/styles.scss'
        ],
    encapsulation: ViewEncapsulation.None
})
export class LobbyComponent implements OnInit {
    cbk: DeviceSettingsCbk;
    displaySettings = false;
    isInLobby = false;
    state: 'offline' | 'online' = 'offline';

    stream: Stream | undefined;
    mediaStream: MediaStream | undefined;
    hasMediaStreamSet = false;

    private streamLiveData: StreamLiveData | undefined;
    private mixer?: StreamMixer;

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
                            this.mixer = new StreamMixer('canvasOne');
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
            .then((stream: any) => this.mediaStream = stream)
            .then(() => (document.getElementById('video') as HTMLVideoElement))
            .then((element: any) => {
                    if (this.mediaStream) {
                        element.srcObject = this.mediaStream;
                        this.hasMediaStreamSet = true;
                        if (!!this.mixer) {
                            this.mixer.appendStream(this.mediaStream);
                        }
                    }
                }
            );
    }

    goBack(): void {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = undefined;
        }
        this.location.back();
    }

    join(): void {
        if (!!this.stream && !!this.mediaStream && this.streamId !== undefined && this.spaceId !== undefined) {
            this.lobbyService.add$.pipe(filter(s => s !== null)).subscribe((s: any) => {
                if (s !== null) {
                    this.getOrCreateVideoElement(s.id).srcObject = s;
                    if (this.mixer) {
                        this.mixer.appendStream(s);
                    }
                }
            });
            this.lobbyService.remove$.pipe(filter(s => s !== null)).subscribe((s: any) => {
                if (s !== null && this.hasVideoElement(s)) {
                    this.removeVideoElement(s);
                    if (this.mixer) {
                        this.mixer.removeStream(s);
                    }
                }
            });

            const streams: Map<MediaStreamType, MediaStream> = new Map<MediaStreamType, MediaStream>();
            streams.set(MediaStreamType.GUEST, this.mediaStream);

            if (!!this.mixer) {
                streams.set(MediaStreamType.STREAM, this.mixer.getMixedStream());
            }

            this.lobbyService.join(streams, this.spaceId, this.streamId, this.config).then(() => this.isInLobby = true);
        }
    }

    hasVideoElement(id: string): boolean {
        return document.getElementById(id) !== null;
    }

    getOrCreateVideoElement(id: string): HTMLVideoElement {
        if (this.hasVideoElement(id)) {
            return document.getElementById(id) as HTMLVideoElement;
        }
        return this.createVideoElement(id);
    }

    createVideoElement(id: string): HTMLVideoElement {
        const box = document.createElement('div');
        box.classList.add('lobby-quest-video-box');

        const buttonGroup = document.createElement('div');
        buttonGroup.classList.add('btn-group');
        buttonGroup.classList.add('control-bar');
        const buttonLabal = document.createElement('div');
        buttonGroup.classList.add('btn');
        buttonGroup.classList.add('btn-primary');
        buttonGroup.classList.add('active');
        const checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.checked = false;
        checkbox.id = `checkbox-${id}`;
        checkbox.disabled = true;

        const span = document.createElement('span');
        span.innerText = ' active';
        buttonGroup.appendChild(buttonLabal);
        buttonLabal.appendChild(checkbox);
        buttonLabal.appendChild(span);

        buttonLabal.addEventListener('click', (evt) => {
            this.toggleActive(id, `checkbox-${id}`);
        });

        const video = document.createElement('video');
        video.setAttribute('id', id);
        video.setAttribute('muted', '');
        video.setAttribute('autoplay', '');
        box.appendChild(video);
        box.appendChild(buttonGroup);
        const elem = (document.getElementById('lobby-quest-video') as HTMLDivElement);
        elem.appendChild(box);
        return video;
    }

    removeVideoElement(id: string) {
        document.getElementById(id)?.remove();
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
        const isChecked = !(document.getElementById(checkboxId) as HTMLInputElement).checked;
        (document.getElementById(checkboxId) as HTMLInputElement).checked = isChecked;

        if (isChecked) {
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
