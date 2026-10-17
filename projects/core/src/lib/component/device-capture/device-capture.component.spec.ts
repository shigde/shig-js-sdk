import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {provideRouter} from '@angular/router';
import {DeviceCaptureComponent} from './device-capture.component';
import {MediaDeviceManager} from '../../provider';
import {LoadingIndicatorComponent} from '../loading-indicator/loading-indicator.component';

describe('DeviceCaptureComponent loading', () => {
  let component: DeviceCaptureComponent;
  let getUserMedia: jasmine.Spy;
  let resolveMedia: (stream: MediaStream) => void;
  let rejectMedia: (error: Error) => void;

  beforeEach(async () => {
    const media = new Promise<MediaStream>((resolve, reject) => {
      resolveMedia = resolve;
      rejectMedia = reject;
    });
    getUserMedia = jasmine.createSpy('getUserMedia').and.returnValue(media);
    component = new DeviceCaptureComponent({
      getUserMedia,
      listenOnChange: () => {}, removeOnChange: () => {},
      captureDeviceList: async () => ({cameras: new Map(), microphones: new Map(), speakers: new Map(), selectedDevice: {}}),
    } as unknown as MediaDeviceManager);
    await component.ngOnInit();
  });

  it('blocks selection and device changes until media is ready', async () => {
    const selected = spyOn(component.onSelect, 'emit');
    const request = component.startStream();
    await Promise.resolve();
    expect(component.isLoading()).toBeTrue();
    component.select();
    await component.onCameraChange('another-device');
    expect(selected).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    resolveMedia({getTracks: () => []} as unknown as MediaStream);
    await request;
    expect(component.isLoading()).toBeFalse();
  });

  it('unlocks controls after a device error', async () => {
    const request = component.startStream();
    await Promise.resolve();
    rejectMedia(new Error('device unavailable'));
    await request;
    expect(component.isLoading()).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
  });

  it('stops a late media result after the dialog has been destroyed', async () => {
    const stop = jasmine.createSpy('stop');
    const request = component.startStream();
    await Promise.resolve();
    component.ngOnDestroy();
    resolveMedia({getTracks: () => [{stop}]} as unknown as MediaStream);
    await request;
    expect(stop).toHaveBeenCalled();
  });
});

describe('DeviceCaptureComponent rendered loading overlay', () => {
  async function setup() {
    let resolve!: (stream: MediaStream) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<MediaStream>((yes, no) => { resolve = yes; reject = no; });
    const getUserMedia = jasmine.createSpy('getUserMedia').and.returnValue(pending);
    await TestBed.configureTestingModule({
      declarations: [DeviceCaptureComponent],
      imports: [FormsModule, LoadingIndicatorComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [provideRouter([]), {provide: MediaDeviceManager, useValue: {
        getUserMedia, listenOnChange: () => {}, removeOnChange: () => {},
        captureDeviceList: async () => ({cameras: new Map(), microphones: new Map(), speakers: new Map(), selectedDevice: {}}),
      }}],
    }).compileComponents();
    spyOn(HTMLMediaElement.prototype, 'play').and.resolveTo();
    const fixture = TestBed.createComponent(DeviceCaptureComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.cameras = [{deviceId: 'camera', label: 'Camera'} as MediaDeviceInfo];
    component.microphones = [{deviceId: 'microphone', label: 'Microphone'} as MediaDeviceInfo];
    fixture.detectChanges();
    return {fixture, component, getUserMedia, resolve, reject};
  }

  for (const device of ['camera', 'microphone'] as const) {
    it(`renders the spinner and disables the form while ${device} capture is pending`, async () => {
      const {fixture, component, getUserMedia, resolve} = await setup();
      const request = device === 'camera'
        ? component.onCameraChange('camera') : component.onMicrophoneChange('microphone');
      // Let Angular render the signal while the media request remains unresolved.
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('.spinner-container.local')).not.toBeNull();
      expect(root.querySelector('.modal-content')?.getAttribute('aria-busy')).toBe('true');
      const spinner = root.querySelector('.loader')!;
      expect(getComputedStyle(spinner).width).toBe('48px');
      expect(getComputedStyle(spinner).borderBottomColor).toBe('rgb(255, 61, 0)');
      const overlay = root.querySelector('.spinner-container.local')!;
      expect(getComputedStyle(overlay).position).toBe('absolute');
      root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button, select')
        .forEach(control => expect(control.matches(':disabled')).toBeTrue());
      await Promise.resolve();
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      resolve(new MediaStream());
      await request;
      await fixture.whenStable();
      expect(root.querySelector('.spinner-container')).toBeNull();
      expect(root.querySelector<HTMLSelectElement>('#formGroupCamera')?.disabled).toBeFalse();
      fixture.destroy();
    });
  }

  it('removes the overlay and unlocks the form when capture fails', async () => {
    const {fixture, component, reject} = await setup();
    const request = component.onCameraChange('camera');
    await Promise.resolve();
    reject(new Error('Camera unavailable'));
    await request;
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.spinner-container')).toBeNull();
    expect(fixture.nativeElement.querySelector('#formGroupCamera').disabled).toBeFalse();
    expect(component.errorMessage).toBeTruthy();
    fixture.destroy();
  });
});
