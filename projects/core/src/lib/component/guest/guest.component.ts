import {
    AfterViewInit,
    Component, ElementRef,
    HostBinding,
    Input,
    OnDestroy, ViewChild,
    ViewEncapsulation
} from '@angular/core';
import {Guest} from '../../entities';

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

    @Input() activateGuestStreamCbk!: (g: Guest) => void;
    @Input() deactivateGuestStreamCbk!: (g: Guest) => void;
    @Input('guest') guest!: Guest;

    ngAfterViewInit() {
        this.getVideoElement().srcObject = this.guest?.stream;
    }

    public updateGuest(guest: Guest): void {
        const oldGuest = this.guest;
        this.guest = guest;
        this.getVideoElement().srcObject = this.guest?.stream;
        if (oldGuest.stream.id !== this.guest.stream.id) {
            // if get a complete new stream, stop the old stream
            // this happens often for local users
            oldGuest.stopStream();
        }
    }

    ngOnDestroy(): void {
        this.getVideoElement().srcObject = null;
        this.guest.stopStream();
    }

    toggleActive() {
        const shadowRoot = document.getElementById(`switch-${this.guest.stream.id}`)?.shadowRoot;
        const isSelected = !shadowRoot?.querySelector('div')?.classList.contains('selected');

        if (isSelected) {
            this.activateGuestStreamCbk(this.guest);
        } else {
            this.deactivateGuestStreamCbk(this.guest);
        }
    }

    private getVideoElement(): HTMLVideoElement {
        return this.videoRef.nativeElement;
    }
}

