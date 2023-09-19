import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Stream} from '../entities/stream';
import {StreamService} from '../../../../core/src/lib/provider/stream.service';
import {LobbyService} from '../../../../core/src/lib/provider/lobby.service';
import {Location} from '@angular/common';
import {filter, tap} from 'rxjs';
import {environment} from '../../environments/environment';
import {SessionService} from '../../../../core/src/lib/provider/session.service';
import {SHIG_PARAMS} from '../../../../core/src/lib/provider/shig-parameter';

@Component({
  selector: 'shig-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent implements OnInit {
  stream: Stream | undefined;
  mediaStream: MediaStream | undefined;
  private readonly config: RTCConfiguration = {
    iceServers: environment.iceServers
  };

  @Input() token: string | undefined;
  @Input('api-prefix') apiPrefix: string | undefined;
  @Output() loadComp = new EventEmitter();

  constructor(
    private session: SessionService,
    private streamService: StreamService,
    private lobbyService: LobbyService,
    private location: Location
  ) {
  }

  ngOnInit(): void {
    if (this.apiPrefix !== undefined) {
      SHIG_PARAMS.API_PREFIX = this.apiPrefix;
    }
    this.session.setAuthenticationToken(this.getToken());
    this.getStream();

    setTimeout(() => {
      this.loadComp.emit('Component loaded successfully!');
    }, 100);

  }

  getStream(): void {
    const id = 'value';
    if (id !== null) {
      this.streamService.getStream(id)
        .pipe(tap((stream) => this.stream = stream))
        .subscribe((_) => this.startCamera());
    }
  }

  startCamera() {
    navigator.mediaDevices
      .getUserMedia({audio: true, video: true})
      .then((stream) => this.mediaStream = stream)
      .then(() => (document.getElementById('video') as HTMLVideoElement))
      .then(element => {
          if (this.mediaStream) {
            element.srcObject = this.mediaStream;
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

  start(): void {
    if (!!this.stream && !!this.mediaStream) {
      this.lobbyService.add$.pipe(filter(s => s !== null)).subscribe((s) => {
        if (s !== null) {
          this.getOrCreateVideoElement(s.id).srcObject = s;
        }
      });
      this.lobbyService.remove$.pipe(filter(s => s !== null)).subscribe((s) => {
        if (s !== null && this.hasVideoElement(s)) {
          this.removeVideoElement(s);
        }
      });
      this.lobbyService.join(this.mediaStream, '123', this.stream.id, this.config).then(() => console.log('Connected'));
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
    const video = document.createElement('video');
    video.setAttribute('id', id);
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    const elem = (document.getElementById('remote-video-container') as HTMLDivElement);
    elem.appendChild(video);
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
}
