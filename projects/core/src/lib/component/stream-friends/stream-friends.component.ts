import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  Input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {Combobox} from '@angular/aria/combobox';
import {Listbox, Option} from '@angular/aria/listbox';
import {toObservable} from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';

import {createLogger, StreamFriendService, UserService} from '../../provider';
import {StreamFriend} from '../../entities';


@Component({
  selector: 'app-stream-friends',
  templateUrl: './stream-friends.component.html',
  styleUrl: './stream-friends.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamFriendsComponent {
  private log = createLogger('StreamFriendsComponent');

  /* =======================
   * Inputs
   * ======================= */

  private _streamUuid?: string;

  @Input()
  set streamUuid(value: string | undefined) {
    if (!value || this._streamUuid === value) return;
    this._streamUuid = value;

    this.friendService.getStreamFriendsList(value)
      .pipe(
        take(1),
        tap(friends => {
          this.log.info('Load streaming friends');
          this.guests.set(friends);
        }),
      )
      .subscribe();
  }

  get streamUuid(): string | undefined {
    return this._streamUuid;
  }

  @Input() userUuid?: string;

  /* =======================
   * View refs
   * ======================= */

  listbox = viewChild<Listbox<StreamFriend>>(Listbox);
  options = viewChildren<Option<StreamFriend>>(Option);
  combobox = viewChild<Combobox<StreamFriend>>(Combobox);

  /* =======================
   * Signals (State)
   * ======================= */

  query = signal('');
  guests = signal<StreamFriend[]>([]);
  allFriends = signal<StreamFriend[]>([]);
  isAdding = signal(false);
  loadingAllFriends = signal(false);

  guestToConfirm: StreamFriend | null = null;

  /* =======================
   * Derived state
   * ======================= */

  friends = computed(() => {
    const q = this.query().toLowerCase();
    const guests = this.guests();
    const all = this.allFriends();

    if (q.length < 2) return [];

    return all.filter(friend => {
      if (guests.some(g => g.uuid === friend.uuid)) {
        return false;
      }

      return `${friend.name}@${friend.domain}`
        .toLowerCase()
        .startsWith(q);
    });
  });

  /* =======================
   * RxJS bridge (debounce + HTTP)
   * ======================= */

  private query$ = toObservable(this.query);

  constructor(
    private friendService: StreamFriendService,
    private userService: UserService,
  ) {
    /* Scroll active option into view */
    afterRenderEffect(() => {
      const option = this.options().find(o => o.active());
      setTimeout(() => option?.element.scrollIntoView({block: 'nearest'}), 50);
    });

    /* Reset scroll when combobox closes */
    afterRenderEffect(() => {
      if (!this.combobox()?.expanded()) {
        setTimeout(() => this.listbox()?.element.scrollTo(0, 0), 150);
      }
    });

    /* Autocomplete search */
    this.query$
      .pipe(
        map(q => q.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) {
            this.allFriends.set([]);
            return of([]);
          }

          this.loadingAllFriends.set(true);

          return this.userService.searchUser(q).pipe(
            // filter current user
            map(users => users.filter(u => u.uuid !== this.userUuid)),
            tap(users => this.allFriends.set(users)),
            catchError(() => {
              this.allFriends.set([]);
              return of([]);
            }),
            finalize(() => this.loadingAllFriends.set(false)),
          );
        }),
      )
      .subscribe();
  }

  /* =======================
   * Actions
   * ======================= */

  askRemove(guest: StreamFriend) {
    this.guestToConfirm = guest;
  }

  confirmRemoveInline(guest: StreamFriend) {
    this.removeFriend(guest.uuid);
    this.guestToConfirm = null;
  }

  addFriend() {
    if (!this._streamUuid) {
      return;
    }

    let friend = this.options().find(o => o.active())?.value();
    const inputValue = this.combobox()?.inputElement()?.value;

    if (!friend || !inputValue) return;

    if (`${friend.name}@${friend.domain}` !== inputValue) {
      friend = this.allFriends()
        .find(f => `${f.name}@${f.domain}` === inputValue);
      if (!friend) return;
    }

    this.isAdding.set(true);

    this.friendService.addStreamFriend(this._streamUuid, friend.uuid)
      .pipe(
        take(1),
        tap(() => {
          this.guests.update(g => [...g, friend!]);
          this.query.set('');
          this.combobox()?.close();
        }),
        finalize(() => this.isAdding.set(false)),
      ).subscribe();
  }

  removeFriend(uuid: string) {
    if (!this._streamUuid) {
      return
    }

    this.isAdding.set(true);
    this.friendService.removeStreamFriend(this._streamUuid, uuid).pipe(
      take(1),
      tap(() => this.guests.update(g => g.filter(friend => friend.uuid !== uuid))),
      finalize(() => this.isAdding.set(false))
    ).subscribe();
  }
}
