import {fakeAsync, tick} from '@angular/core/testing';
import {HttpClient} from '@angular/common/http';
import {of, throwError} from 'rxjs';
import {ParameterService} from './parameter.service';
import {RelayService} from './relay.service';

describe('RelayService live status', () => {
  it('shares polling within a channel and stops after the last subscriber leaves', fakeAsync(() => {
    const get = jasmine.createSpy('get').and.returnValue(of('stream-a'));
    const relay = new RelayService({get} as unknown as HttpClient, {API_PREFIX: '/api'} as ParameterService);
    let liveA = false;
    let liveB = true;
    const first = relay.pollHasAnnouncement('channel', 'stream-a').subscribe(value => liveA = value);
    const second = relay.pollHasAnnouncement('channel', 'stream-b').subscribe(value => liveB = value);
    tick(0);
    expect(get).toHaveBeenCalledTimes(1);
    expect(liveA).toBeTrue();
    expect(liveB).toBeFalse();
    get.and.returnValue(of(''));
    tick(5000);
    expect(liveA).toBeFalse();
    first.unsubscribe();
    second.unsubscribe();
    tick(10000);
    expect(get).toHaveBeenCalledTimes(2);
  }));

  it('retries on the next interval after a failed request', fakeAsync(() => {
    const get = jasmine.createSpy('get').and.returnValues(throwError(() => new Error('network')), of('stream'));
    const relay = new RelayService({get} as unknown as HttpClient, {API_PREFIX: '/api'} as ParameterService);
    let live = false;
    const subscription = relay.pollHasAnnouncement('channel', 'stream').subscribe(value => live = value);
    tick(0);
    tick(5000);
    expect(live).toBeTrue();
    subscription.unsubscribe();
  }));
});
