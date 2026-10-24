import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {ConnectionDashboardComponent} from './connection-dashboard.component';
import {MetricsView, parseConnectionMetrics, WebrtcMetricsService} from '../../provider/webrtc-metrics.service';

describe('Connection dashboard', () => {
  it('renders missing outgoing feedback differently from measured zero incoming loss and releases collection', async () => {
    const pc = {connectionState: 'connected', iceConnectionState: 'connected'} as RTCPeerConnection;
    const view = new BehaviorSubject<MetricsView>({samples: [{timestamp: 100000,
      connections: [
        parseConnectionMetrics('send', {pc, direction: 'send'}, {audio: {outbound: [{id: 'a', bitrate: 64000}]}}),
        parseConnectionMetrics('receive', {pc, direction: 'receive'}, {audio: {inbound: [{id: 'b', bitrate: 128000, packetLossRate: 0}]}}),
      ]}], events: []});
    const release = jasmine.createSpy('release');
    const observe = jasmine.createSpy('observe').and.returnValue(release);
    await TestBed.configureTestingModule({imports: [ConnectionDashboardComponent],
      providers: [{provide: WebrtcMetricsService, useValue: {view$: view.asObservable(), observe}}]}).compileComponents();
    const fixture = TestBed.createComponent(ConnectionDashboardComponent);
    fixture.detectChanges();
    const cards = fixture.componentInstance.panel.nativeElement.querySelectorAll('[data-kind="audio"] td') as NodeListOf<HTMLElement>;
    expect(cards[1].textContent).toContain('64.0 kbit/s');
    expect(cards[2].textContent).toBe('—');
    fixture.componentInstance.panel.nativeElement.querySelector<HTMLButtonElement>('[data-direction="receive"]')!.click();
    fixture.detectChanges();
    const incoming = fixture.componentInstance.panel.nativeElement.querySelectorAll('[data-kind="audio"] td');
    expect(incoming[1].textContent).toContain('128.0 kbit/s');
    expect(incoming[2].textContent).toContain('0.00 %');
    fixture.destroy();
    expect(observe).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.connection-dashboard').length).toBe(0);
  });
});

describe('Floating connection dashboard', () => {
  let view: BehaviorSubject<MetricsView>;
  let release: jasmine.Spy;
  let observe: jasmine.Spy;
  beforeEach(async () => {
    view = new BehaviorSubject<MetricsView>({samples: [], events: []});
    release = jasmine.createSpy('release');
    observe = jasmine.createSpy('observe').and.returnValue(release);
    await TestBed.configureTestingModule({imports: [ConnectionDashboardComponent],
      providers: [{provide: WebrtcMetricsService, useValue: {view$: view.asObservable(), observe}}]}).compileComponents();
  });

  function fakePopup() {
    const events = new EventTarget();
    const popup = {document: document.implementation.createHTMLDocument(), closed: false,
      focus: jasmine.createSpy('focus'), close: jasmine.createSpy('close').and.callFake(() => popup.closed = true),
      addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events)};
    return {popup: popup as unknown as Window, events};
  }

  it('keeps the same live view and collection lease when detaching and returning after window close', () => {
    const fixture = TestBed.createComponent(ConnectionDashboardComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance.panel.nativeElement;
    const {popup, events} = fakePopup();
    spyOn(window, 'open').and.returnValue(popup);
    fixture.componentInstance.detach(); fixture.detectChanges();
    expect(host.ownerDocument).toBe(popup.document);
    expect(popup.document.body.textContent).toContain('Dock');
    view.next({samples: [], events: [{timestamp: Date.now(), message: 'live update after detach'}]});
    fixture.detectChanges();
    expect(popup.document.body.textContent).toContain('live update after detach');
    expect(observe).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    events.dispatchEvent(new Event('beforeunload')); fixture.detectChanges();
    expect(host.ownerDocument).toBe(document);
    expect(document.body.contains(host)).toBeTrue();
    expect(fixture.componentInstance.detached).toBeFalse();
    fixture.componentInstance.detach(); fixture.detectChanges();
    (popup.document.body.querySelector('[title="Return to lobby"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.ownerDocument).toBe(document);
    expect(popup.close).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(release).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.connection-dashboard').length).toBe(0);
  });

  it('keeps the inline panel usable when a popup is blocked', () => {
    const fixture = TestBed.createComponent(ConnectionDashboardComponent);
    fixture.detectChanges();
    spyOn(window, 'open').and.returnValue(null);
    fixture.componentInstance.detach(); fixture.detectChanges();
    expect(fixture.componentInstance.detached).toBeFalse();
    expect(fixture.componentInstance.panel.nativeElement.querySelector('[role="alert"]')!.textContent).toContain('blocked');
    expect(document.body.contains(fixture.componentInstance.panel.nativeElement)).toBeTrue();
    fixture.destroy();
  });

  it('closes the detached window and restores DOM ownership when leaving the lobby', () => {
    const fixture = TestBed.createComponent(ConnectionDashboardComponent);
    fixture.detectChanges();
    const {popup} = fakePopup();
    spyOn(window, 'open').and.returnValue(popup);
    fixture.componentInstance.detach(); fixture.detectChanges();
    fixture.destroy();
    expect(popup.close).toHaveBeenCalledTimes(1);
    expect(popup.document.body.children.length).toBe(0);
    expect(release).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.connection-dashboard').length).toBe(0);
  });

  it('moves with arrow keys and stays inside the viewport', () => {
    const fixture = TestBed.createComponent(ConnectionDashboardComponent);
    fixture.detectChanges();
    fixture.componentInstance.left = 8;
    const key = new KeyboardEvent('keydown', {key: 'ArrowLeft', cancelable: true});
    fixture.componentInstance.moveWithKeyboard(key); fixture.detectChanges();
    expect(key.defaultPrevented).toBeTrue();
    expect(fixture.componentInstance.left).toBe(8);
    fixture.componentInstance.left = window.innerWidth + 500;
    fixture.componentInstance.top = window.innerHeight + 500;
    fixture.componentInstance.keepInViewport(); fixture.detectChanges();
    const bounds = fixture.componentInstance.panel.nativeElement.getBoundingClientRect();
    expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
    expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    fixture.destroy();
  });
  it('drags by the handle and releases pointer listeners at the end of a drag', () => {
    const fixture = TestBed.createComponent(ConnectionDashboardComponent);
    fixture.detectChanges();
    const handle = fixture.componentInstance.panel.nativeElement.querySelector('.drag-handle') as HTMLElement;
    spyOn(handle, 'setPointerCapture');
    spyOn(handle, 'hasPointerCapture').and.returnValue(false);
    const rect = fixture.componentInstance.panel.nativeElement.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 7, button: 0, clientX: 200, clientY: 200}));
    handle.dispatchEvent(new PointerEvent('pointermove', {pointerId: 7, clientX: 168, clientY: 168}));
    fixture.detectChanges();
    expect(fixture.componentInstance.left).toBe(Math.max(8, rect.left - 32));
    expect(fixture.componentInstance.top).toBe(Math.max(8, rect.top - 32));
    handle.dispatchEvent(new PointerEvent('pointerup', {pointerId: 7}));
    const left = fixture.componentInstance.left;
    handle.dispatchEvent(new PointerEvent('pointermove', {pointerId: 7, clientX: 30, clientY: 30}));
    expect(fixture.componentInstance.left).toBe(left);
    fixture.destroy();
  });

});

@Component({standalone: true, imports: [ConnectionDashboardComponent], template: '@if (open) { <shig-connection-dashboard (dismiss)="open = false"/> }'})
class DashboardHost { open = true; }

describe('Dashboard structural teardown', () => {
  it('does not leave panels or collectors behind after repeatedly closing via Angular control flow', async () => {
    const release = jasmine.createSpy('release');
    const observe = jasmine.createSpy('observe').and.returnValue(release);
    await TestBed.configureTestingModule({imports: [DashboardHost], providers: [{provide: WebrtcMetricsService,
      useValue: {view$: new BehaviorSubject<MetricsView>({samples: [], events: []}), observe}}]}).compileComponents();
    const fixture = TestBed.createComponent(DashboardHost);
    for (let i = 0; i < 4; i++) {
      fixture.componentInstance.open = true; fixture.detectChanges();
      expect(document.querySelectorAll('.connection-dashboard').length).toBe(1);
      expect(document.querySelector('.connection-dashboard')!.getBoundingClientRect().width).toBeLessThanOrEqual(390);
      expect(document.querySelectorAll('.graph[open]').length).toBe(0);
      (document.querySelector('[aria-label="Close dashboard"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(document.querySelectorAll('.connection-dashboard').length).toBe(0);
    }
    expect(observe).toHaveBeenCalledTimes(4);
    expect(release).toHaveBeenCalledTimes(4);
    fixture.destroy();
  });

  it('retains styles and closes cleanly when the visible panel is moved to another real document', async () => {
    await TestBed.configureTestingModule({imports: [DashboardHost], providers: [{provide: WebrtcMetricsService,
      useValue: {view$: new BehaviorSubject<MetricsView>({samples: [], events: []}), observe: () => () => {}}}]}).compileComponents();
    const fixture = TestBed.createComponent(DashboardHost); fixture.detectChanges();
    const iframe = document.createElement('iframe'); document.body.append(iframe);
    const popup = iframe.contentWindow!;
    spyOn(popup, 'close'); spyOn(popup, 'focus');
    spyOn(window, 'open').and.returnValue(popup);
    (document.querySelector('[title="Open in a separate window"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const panel = popup.document.querySelector('.connection-dashboard')!;
    expect(popup.getComputedStyle(panel).display).toBe('flex');
    expect(popup.getComputedStyle(panel).position).toBe('static');
    expect(document.querySelectorAll('.connection-dashboard').length).toBe(0);
    expect(document.querySelectorAll('shig-connection-dashboard').length).toBe(1);
    (popup.document.querySelector('[aria-label="Close dashboard"]') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(popup.close).toHaveBeenCalled();
    expect(popup.document.querySelectorAll('.connection-dashboard').length).toBe(0);
    expect(document.querySelectorAll('.connection-dashboard').length).toBe(0);
    iframe.remove(); fixture.destroy();
  });
});
