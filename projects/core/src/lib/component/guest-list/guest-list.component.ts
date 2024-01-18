import {
    ChangeDetectorRef,
    Component,
    ComponentRef,
    EventEmitter,
    HostBinding,
    Input,
    OnInit,
    Output,
    ViewChild,
    ViewEncapsulation
} from '@angular/core';
import {LobbyMediaPurpose, LobbyMediaStream} from '../../entities';
import {filter, Observable} from 'rxjs';
import {LobbyService} from '../../provider';
import {GuestComponent} from '../guest/guest.component';
import {GuestListDirective} from './guest-list.directive';

@Component({
    selector: 'shig-guest-list',
    templateUrl: './guest-list.component.html',
    styleUrls: [
        './../../../../assets/scss/lobby.scss',
        './../../../../assets/scss/styles.scss'
    ],
    encapsulation: ViewEncapsulation.None
})
export class GuestListComponent implements OnInit {
    @HostBinding('class.guest-area') public hostClass = true;
    @Output() activateLobbyMediaStreamEvent = new EventEmitter<LobbyMediaStream>();
    @Output() deactivateLobbyMediaStreamEvent = new EventEmitter<LobbyMediaStream>();
    @Input() localGuest$!: Observable<any>;
    @Input() istHost: boolean = false;

    @ViewChild(GuestListDirective, {static: true}) shigGuestList!: GuestListDirective;
    public readonly cmpRefMap = new Map<string, ComponentRef<GuestComponent>>();

    constructor(private ref: ChangeDetectorRef, private lobbyService: LobbyService) {
        this.lobbyService.add$.pipe(filter(s => s !== null)).subscribe((s) => {
            if(s !== null && s?.media.purpose == LobbyMediaPurpose.GUEST) {
                this.upsertGuest(LobbyMediaStream.build(s.media, s.stream));
            }
            if(s !== null && s?.media.purpose == LobbyMediaPurpose.STREAM) {
                this.activateLobbyMediaStreamEvent.emit(LobbyMediaStream.build(s.media, s.stream))
            }
        });
        this.lobbyService.remove$.pipe(filter(s => s !== null)).subscribe((media) => {
            console.log("###", media)
            if(media !== null && media.purpose == LobbyMediaPurpose.GUEST && this.hasGuest(media.streamId)) {
                this.removeGuest(media.streamId);
            }
            if(media !== null && media.purpose == LobbyMediaPurpose.STREAM) {
                this.deactivateLobbyMediaStreamEvent.emit(LobbyMediaStream.build(media));
            }
        });
    }

    ngOnInit() {
        this.localGuest$.subscribe((local) => {
            if (local !== undefined) {
                this.upsertGuest(local, true);
            }
        });
    }

    private hasGuest(guestId: string): boolean {
        return this.cmpRefMap.has(guestId);
    }

    private upsertGuest(lobbyMediaStream: LobbyMediaStream, isLocal: boolean = false): void {
        if (this.hasGuest(lobbyMediaStream.streamId)) {
            this.cmpRefMap.get(lobbyMediaStream.streamId)?.instance.updateGuest(lobbyMediaStream);
            return;
        }
        const componentRef = this.shigGuestList.viewContainerRef.createComponent<GuestComponent>(GuestComponent);
        componentRef.instance.media = lobbyMediaStream;
        componentRef.instance.isLocal = isLocal
        componentRef.instance.onHost = this.istHost;
        componentRef.instance.activateGuestStreamCbk = (g: LobbyMediaStream) => this.activateLobbyMediaStreamEvent.emit(g);
        componentRef.instance.deactivateGuestStreamCbk = (g: LobbyMediaStream) => this.deactivateLobbyMediaStreamEvent.emit(g);
        this.cmpRefMap.set(lobbyMediaStream.streamId, componentRef);
        this.ref.detectChanges();
    }

    public removeGuest(streamId: string): void {
        if (this.shigGuestList.viewContainerRef.length < 1 || !this.hasGuest(streamId)) return;
        const componentRef = this.cmpRefMap.get(streamId);

        if (componentRef !== undefined) {
            const vcrIndex: number = this.shigGuestList.viewContainerRef.indexOf(componentRef.hostView);
            // removing component from html container
            this.shigGuestList.viewContainerRef.remove(vcrIndex);
            // removing component from the ref list
            this.cmpRefMap.delete(streamId);
            componentRef.hostView.destroy();
        }
    }
}

