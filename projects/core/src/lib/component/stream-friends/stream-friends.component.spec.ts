import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {ShigModule} from '../../shig-module';
import {StreamFriendService, UserService} from '../../provider';
import {StreamFriendsComponent} from './stream-friends.component';
import {Role, StreamFriend} from '../../entities';

describe('Guest invitation search', () => {
  it('renders selectable search results inside the settings content', async () => {
    const friend: StreamFriend = {
      uuid: 'guest', name: 'admin', domain: 'localhost:4200',
      channel_uuid: 'channel', avatar: '', role: Role.GUEST,
    };
    const addStreamFriend = jasmine.createSpy('addStreamFriend').and.returnValue(of(null));
    const removeStreamFriend = jasmine.createSpy('removeStreamFriend').and.returnValue(of(null));
    TestBed.configureTestingModule({
      imports: [ShigModule],
      providers: [
        {provide: StreamFriendService, useValue: {
          getStreamFriendsList: () => of([]), addStreamFriend, removeStreamFriend,
        }},
        {provide: UserService, useValue: {searchUser: () => of([friend])}},
      ],
    });
    const fixture = TestBed.createComponent(StreamFriendsComponent);
    fixture.componentRef.setInput('streamUuid', 'stream');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.focus();
    input.value = 'admin';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const popup = fixture.nativeElement.querySelector('.stream-guest-settings .popup');
    expect(popup).not.toBeNull();
    const option = popup.querySelector('[ngOption]') as HTMLElement;
    expect(option.textContent).toContain('admin@localhost:4200');
    expect(getComputedStyle(popup).overflowY).toBe('auto');
    option.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.guest-invite-button').click();
    fixture.detectChanges();
    expect(addStreamFriend).toHaveBeenCalledWith('stream', 'guest');
    fixture.componentInstance.guests.set([friend, {...friend, uuid: 'second', name: 'other'}]);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.invited-guest-row');
    const height = rows[0].getBoundingClientRect().height;
    const nextTop = rows[1].getBoundingClientRect().top;
    rows[0].querySelector('[aria-label="Remove invitation"]').click();
    fixture.detectChanges();
    expect(rows[0].textContent).toContain('Remove invitation?');
    expect(rows[0].getBoundingClientRect().height).toBe(height);
    expect(rows[1].getBoundingClientRect().top).toBe(nextTop);
    rows[0].querySelector('[aria-label="Cancel removal"]').click();
    fixture.detectChanges();
    expect(rows[0].textContent).toContain('admin');
    expect(removeStreamFriend).not.toHaveBeenCalled();
    rows[0].querySelector('[aria-label="Remove invitation"]').click();
    fixture.detectChanges();
    rows[0].querySelector('[aria-label="Confirm removal"]').click();
    fixture.detectChanges();
    expect(removeStreamFriend).toHaveBeenCalledWith('stream', 'guest');
    expect(fixture.componentInstance.guests().map(guest => guest.uuid)).toEqual(['second']);
    fixture.destroy();
  });
  it('stages guests without a stream or immediate invitation requests', async () => {
    const friend = {uuid: 'guest', name: 'admin', domain: 'localhost', role: Role.GUEST} as StreamFriend;
    const add = jasmine.createSpy('add');
    const remove = jasmine.createSpy('remove');
    TestBed.configureTestingModule({imports: [ShigModule], providers: [
      {provide: StreamFriendService, useValue: {addStreamFriend: add, removeStreamFriend: remove}},
      {provide: UserService, useValue: {searchUser: () => of([friend])}},
    ]});
    const fixture = TestBed.createComponent(StreamFriendsComponent);
    fixture.componentRef.setInput('deferred', true);
    fixture.detectChanges();
    const changed = jasmine.createSpy('changed');
    fixture.componentInstance.guestsChange.subscribe(changed);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.focus(); input.value = 'admin'; input.dispatchEvent(new Event('input', {bubbles: true}));
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    fixture.nativeElement.querySelector('[ngOption]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.guest-invite-button').click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledWith(['guest']);
    expect(add).not.toHaveBeenCalled();
    fixture.componentInstance.removeFriend('guest');
    expect(changed).toHaveBeenCalledWith([]);
    expect(remove).not.toHaveBeenCalled();
    fixture.destroy();
  });

});
