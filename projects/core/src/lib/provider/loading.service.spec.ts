import {LoadingService} from './loading.service';
describe('LoadingService parallel requests', () => {
  it('stays visible until all normal requests finish', () => {
    const service = new LoadingService();
    const states: boolean[] = [];
    const subscription = service.loading$.subscribe(state => states.push(state));
    service.loadingOn(); service.loadingOn(); service.loadingOff();
    expect(states[states.length - 1]).toBeTrue();
    service.loadingOff(); expect(states[states.length - 1]).toBeFalse();
    service.loadingOff(); service.loadingOn(); expect(states[states.length - 1]).toBeTrue();
    subscription.unsubscribe();
  });
});
