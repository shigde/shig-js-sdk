import {
    AfterViewInit,
    Component, ElementRef,
    HostBinding,
    Input,
    OnDestroy, ViewChild,
    ViewEncapsulation
} from '@angular/core';
import {LobbyMediaStream} from '../../entities';

@Component({
    selector: 'shig-guest',
    templateUrl: './guest.component.html',
    styleUrls: [
        './../../../../assets/scss/lobby.scss',
        './../../../../assets/scss/styles.scss'
    ],
    encapsulation: ViewEncapsulation.None
})
export class GuestComponent implements AfterViewInit, OnDestroy {

    @HostBinding('class.guest-video') public hostClass = true;
    @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

    @Input() activateGuestStreamCbk!: (g: LobbyMediaStream) => void;
    @Input() deactivateGuestStreamCbk!: (g: LobbyMediaStream) => void;
    @Input('media') media!: LobbyMediaStream;

    ngAfterViewInit() {
        if(this.media && this.media.stream) {
            this.getVideoElement().srcObject = this.media.stream;
        }
    }

    public updateGuest(media: LobbyMediaStream): void {
        const oldMedia = this.media;
        this.media = media;
        if(this.media.stream) {
            this.getVideoElement().srcObject = this.media.stream;
        }
        if (oldMedia.streamId !== this.media.streamId) {
            // if get a complete new stream, stop the old stream
            // this happens often for local users
            oldMedia.stopStream();
        }
    }

    ngOnDestroy(): void {
        this.getVideoElement().srcObject = null;
        this.media.stopStream();
    }

    toggleActive() {
        const shadowRoot = document.getElementById(`switch-${this.media.streamId}`)?.shadowRoot;
        const isSelected = !shadowRoot?.querySelector('div')?.classList.contains('selected');

        if (isSelected) {
            this.activateGuestStreamCbk(this.media);
        } else {
            this.deactivateGuestStreamCbk(this.media);
        }
    }

    private getVideoElement(): HTMLVideoElement {
        return this.videoRef.nativeElement;
    }
}

