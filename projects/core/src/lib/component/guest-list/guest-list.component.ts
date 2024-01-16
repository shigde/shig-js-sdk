import {
    ChangeDetectorRef,
    Component, ComponentRef,
    EventEmitter, HostBinding,
    Input,
    OnInit,
    Output,
    ViewChild,
    ViewEncapsulation
} from '@angular/core';
import {buildGuest, Guest, LobbyMedia} from '../../entities';
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
    @Output() activateGuestStreamEvent = new EventEmitter<Guest>();
    @Output() deactivateGuestStreamEvent = new EventEmitter<Guest>();
    @Input() localGuest$!: Observable<any>;

    @ViewChild(GuestListDirective, {static: true}) shigGuestList!: GuestListDirective;
    public readonly cmpRefMap = new Map<string, ComponentRef<GuestComponent>>();

    constructor(private ref: ChangeDetectorRef, private lobbyService: LobbyService) {

        this.lobbyService.add$.pipe(filter(s => s !== null)).subscribe((s) => {
            if (s !== null) {
                this.upsertGuest(buildGuest(s.media.streamId, s.media.info, s.stream));
            }
        });
        this.lobbyService.remove$.pipe(filter(s => s !== null)).subscribe((media: any) => {
            if (media !== null || this.hasGuest(media.streamId)) {
                this.removeGuest(media.streamId);
            }
        });
    }

    ngOnInit() {
        this.localGuest$.subscribe((local) => {
            if (local !== undefined) {
                this.upsertGuest(local);
            }
        });
    }

    private hasGuest(guestId: string): boolean {
        return this.cmpRefMap.has(guestId);
    }

    private upsertGuest(guest: Guest): void {
        console.log(guest);

        if (this.hasGuest(guest.user.id)) {
            this.cmpRefMap.get(guest.user.id)?.instance.updateGuest(guest);
            return;
        }
        const componentRef = this.shigGuestList.viewContainerRef.createComponent<GuestComponent>(GuestComponent);
        componentRef.instance.guest = guest;
        componentRef.instance.activateGuestStreamCbk = (g: Guest) => this.activateGuestStreamEvent.emit(g);
        componentRef.instance.deactivateGuestStreamCbk = (g: Guest) => this.deactivateGuestStreamEvent.emit(g);
        this.cmpRefMap.set(guest.user.id, componentRef);
        this.ref.detectChanges();
    }

    public removeGuest(guestId: string): void {
        if (this.shigGuestList.viewContainerRef.length < 1 || !this.hasGuest(guestId)) return;
        const componentRef = this.cmpRefMap.get(guestId);

        if (componentRef !== undefined) {
            const vcrIndex: number = this.shigGuestList.viewContainerRef.indexOf(componentRef.hostView);
            // removing component from html container
            this.shigGuestList.viewContainerRef.remove(vcrIndex);
            // removing component from the ref list
            this.cmpRefMap.delete(guestId);
            componentRef.hostView.destroy();
        }
    }
}

