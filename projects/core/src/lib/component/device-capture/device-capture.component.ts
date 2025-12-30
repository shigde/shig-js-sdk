import {
  Component,
  ElementRef, Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {createLogger, DeviceSettingsService, LocalStoreService} from '../../provider';
import {DeviceSettings} from '../../entities';

export type DeviceSettingsCbk = (s: DeviceSettings) => void;

@Component({
  selector: 'shig-device-capture',
  templateUrl: './device-capture.component.html',
  styleUrl: './device-capture.component.scss',
  standalone: false,
})
export class DeviceCaptureComponent implements OnInit, OnDestroy {
  private readonly log = createLogger('DeviceCaptureComponent');
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  @Input() onSelect: undefined | DeviceSettingsCbk;
  @Input() onClose: undefined | (() => void);
  @Input() doStreamUpdate: boolean = false;

  protected stream: MediaStream | null = null;

  errorMessage: string | null = null;

  cameras: MediaDeviceInfo[] = [];
  microphones: MediaDeviceInfo[] = [];
  speakers: MediaDeviceInfo[] = [];

  storedDeviceSettings: DeviceSettings = DeviceSettings.buildDefault();

  constructor(
    protected media: DeviceSettingsService,
    private store: LocalStoreService,
  ) {
    let deviceSettings = this.store.get();
    if (deviceSettings !== null) {
      this.storedDeviceSettings = deviceSettings;
    }
  }

  async ngOnInit(): Promise<void> {
    navigator.mediaDevices.addEventListener('devicechange', () =>
      this.loadDevices()
    );

    this.log.info('sdk: device capture - init', this.storedDeviceSettings);

    await this.loadDevices();
    await this.startStream();
  }

  ngOnDestroy(): void {
    this.stopStream();
    navigator.mediaDevices.removeEventListener('devicechange', () =>
      this.loadDevices()
    );
  }

  private async loadDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      this.cameras = devices.filter((d) => d.kind === 'videoinput');
      this.microphones = devices.filter((d) => d.kind === 'audioinput');
      this.speakers = devices.filter((d) => d.kind === 'audiooutput');

      if (this.cameras.length > 0) {
        this.storedDeviceSettings.camera = filterSelectedDevices(this.cameras, this.storedDeviceSettings.camera);
      }
      if (this.microphones.length > 0) {
        this.storedDeviceSettings.microphone = filterSelectedDevices(this.microphones, this.storedDeviceSettings.microphone);
      }
      if (this.speakers.length > 0) {
        this.storedDeviceSettings.speaker = filterSelectedDevices(this.speakers, this.storedDeviceSettings.speaker);
      }
    } catch (err: any) {
      this.errorMessage = `Device list could not be loaded: ${err.message}`;
    }
  }

  async startStream(): Promise<void> {
    this.stopStream();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: this.storedDeviceSettings.camera !== null && this.storedDeviceSettings.camera !== undefined && this.storedDeviceSettings.camera !== ''
          ? {deviceId: {exact: this.storedDeviceSettings.camera}}
          : true,
        audio: this.storedDeviceSettings.microphone !== null && this.storedDeviceSettings.microphone !== undefined && this.storedDeviceSettings.microphone !== ''
          ? {deviceId: {exact: this.storedDeviceSettings.microphone}}
          : true,
      });

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        await this.videoElement.nativeElement.play().catch(() => {
          this.errorMessage = 'Autoplay is blocked. Please click Play.';
        });

        if (
          this.storedDeviceSettings.speaker !== null && this.storedDeviceSettings.speaker !== undefined &&
          'setSinkId' in this.videoElement.nativeElement
        ) {
          try {
            // @ts-ignore
            await this.videoElement.nativeElement.setSinkId(
              this.storedDeviceSettings.speaker
            );
          } catch (err: any) {
            this.errorMessage = `Audio output could not be switched. ${err.message}`;
          }
        }
      }

      // this.store.update(this.settings);
      // this.onSelectChange(this.settings);
      this.errorMessage = null;
    } catch (err: any) {
      this.errorMessage = this.mapError(err);
    }
  }

  stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  async onCameraChange(value: any): Promise<void> {
    this.storedDeviceSettings.camera = value;
    await this.startStream();
  }

  async onMicrophoneChange(value: any): Promise<void> {
    this.storedDeviceSettings.microphone = value;
    await this.startStream();
  }

  async onSpeakerChange(value: any): Promise<void> {
    this.storedDeviceSettings.speaker = value;
    await this.startStream();
  }

  private mapError(err: any): string {
    if (err.name === 'NotAllowedError') {
      return 'Access denied – please allow camera/microphone.';
    }
    if (err.name === 'NotFoundError') {
      return 'No suitable device found.';
    }
    if (err.name === 'NotReadableError') {
      return 'Device is already in use.';
    }
    return `Unknown error: ${err.message || err}`;
  }

  closeModal() {
    if (this.onClose !== undefined) {
      this.log.info('sdk: device capture - close');
      this.onClose();
    }
  }

  select() {
    if (this.onSelect !== undefined) {
      this.log.info('sdk: device capture - select');
      this.store.save(this.storedDeviceSettings);
      this.onSelect(this.storedDeviceSettings);
      this.closeModal();
    }
  }
}

let logger = createLogger('DeviceCaptureComponent.f');
function filterSelectedDevices(devices: MediaDeviceInfo[], search: string | null | undefined): string {
  if (!search) {
    logger.debug('sdk: device capture - filterSelectedDevices - no search', devices);
    return devices[0].deviceId;
  }
  let filtered = devices.filter((d) => d.deviceId.includes(search));
  logger.debug('sdk: device capture - filterSelectedDevices - filtered', filtered);
  return filtered.length > 0 ? filtered[0].deviceId : devices[0].deviceId;
}
