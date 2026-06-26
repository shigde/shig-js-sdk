import {
  AfterViewInit, ChangeDetectorRef,
  Component, ElementRef,
  HostListener,
  HostBinding,
  Input,
  OnDestroy, ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {LobbyMediaStream} from '../../entities';
import {createLogger, LobbyService} from '../../provider';
import {StreamMixerService} from '../../provider/stream-mixer.service';
import {filter, Subscription} from 'rxjs';
import '@material/web/switch/switch';

@Component({
  selector: 'shig-guest',
  templateUrl: './guest.component.html',
  styleUrls: [
    './../../../../assets/scss/lobby.scss',
    './../../../../assets/scss/styles.scss'
  ],
  encapsulation: ViewEncapsulation.None,
  standalone: false
})
export class GuestComponent implements AfterViewInit, OnDestroy {

  @HostBinding('class.guest-video') public hostClass = true;
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

  @Input() activateGuestStreamCbk!: (g: LobbyMediaStream) => void;
  @Input() deactivateGuestStreamCbk!: (g: LobbyMediaStream) => void;
  @Input('media') media!: LobbyMediaStream;
  @Input('onHost') onHost!: boolean;
  @Input('isLocal') isLocal!: boolean;

  public audioMuted = false;
  public cameraMuted = false;
  public mixVolume = 1;
  public audioMixerOpen = false;
  public audioMixerOrientation: 'vertical' | 'horizontal' = 'vertical';
  private muteSub: Subscription;
  private readonly log = createLogger('GuestComponent');

  constructor(
    private ref: ChangeDetectorRef,
    private lobbyService: LobbyService,
    private mixer: StreamMixerService,
  ) {
    this.muteSub = this.lobbyService.mute$.pipe(
      filter((media) => media !== null),
      filter((media) => media?.streamId == this.media?.streamId),
    ).subscribe((media) => {

      if (media?.kind == 'audio') {
        this.audioMuted = media?.muted;
      }
      if (media?.kind == 'video') {
        this.cameraMuted = media?.muted;
      }
      this.ref.detectChanges();
    });
  }

  ngAfterViewInit() {
    this.updateAudioMixerOrientation();
    if (this.media && this.media.stream) {
      this.getVideoElement().srcObject = this.media.stream;
      if (this.isLocal) {
        this.getVideoElement().muted = true;
        this.getVideoElement().volume = 0;
      }
    }
  }

  public updateGuest(media: LobbyMediaStream): void {
    const oldMedia = this.media;
    this.log.info('updateGuest');
    this.media = media;
    if (this.media.stream) {
      this.getVideoElement().srcObject = this.media.stream;
      this.log.info('update guest tracks - add media:', this.media.stream.getVideoTracks());
    }
    this.ref.detectChanges();
  }

  ngOnDestroy(): void {
    this.muteSub?.unsubscribe();
    const isSelected = this.isSelected();
    if (isSelected) {
      this.deactivateGuestStreamCbk(this.media);
    }
    this.getVideoElement().srcObject = null;
  }

  toggleMuteVideo() {
    this.cameraMuted = !this.cameraMuted;
    const video = this.media.stream?.getVideoTracks()[0];
    if (!!video && this.isLocal) {
      this.broadcastMute(video.id, this.cameraMuted);
      video.enabled = !this.cameraMuted;
    }
  }

  toggleMuteAudio() {
    this.audioMuted = !this.audioMuted;
    const audio = this.media.stream?.getAudioTracks()[0];
    if (!!audio && this.isLocal) {
      this.broadcastMute(audio.id, this.audioMuted);
      audio.enabled = !this.audioMuted;
    }
  }

  private broadcastMute(trackId: string, muted: boolean): void {
    this.lobbyService.broadcastMute(trackId, muted);
  }

  toggleActive() {
    const isSelected = this.isSelected();
    if (isSelected) {
      this.activateGuestStreamCbk(this.media);
      this.updateMixVolume();
    } else {
      this.deactivateGuestStreamCbk(this.media);
    }
  }

  setMixVolume(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mixVolume = Number(input.value);
    this.updateMixVolume();
  }

  toggleAudioMixer(): void {
    this.audioMixerOpen = !this.audioMixerOpen;
    this.updateAudioMixerOrientation();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateAudioMixerOrientation();
  }

  private getVideoElement(): HTMLVideoElement {
    return this.videoRef.nativeElement;
  }

  private updateMixVolume(): void {
    this.mixer.setVolume(`video-${this.media.streamId}`, this.mixVolume);
  }

  private updateAudioMixerOrientation(): void {
    this.audioMixerOrientation = window.matchMedia('(max-width: 900px)').matches
      ? 'horizontal'
      : 'vertical';
  }

  private isSelected(): boolean {
    const shadowRoot = document.getElementById(`switch-${this.media.streamId}`)?.shadowRoot;
    return !shadowRoot?.querySelector('div')?.classList.contains('selected');
  }
}
