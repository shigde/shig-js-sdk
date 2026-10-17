import {
  AfterViewInit, computed, signal,
  Component,
  ElementRef, EventEmitter, Input,
  OnDestroy,
  OnInit, Output,
  ViewChild,
} from '@angular/core';
import {createLogger, MediaDeviceError} from '../../provider';
import {MediaDeviceList, SelectedDevice} from '../../entities';
import {MediaDeviceManager} from '../../provider';

export type DeviceSettingsCbk = (s: SelectedDevice) => void;

@Component({
  selector: 'shig-device-capture',
  templateUrl: './device-capture.component.html',
  styleUrls: ['./device-capture.component.scss'],
  standalone: false,
})
export class DeviceCaptureComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly log = createLogger('DeviceCaptureComponent');
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  @Output() onSelect = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  @Input() isStreamUpdateModus: boolean = false;

  private viewReady = false;
  private destroyed = false;
  private readonly initialLoading = signal(true);
  private readonly pendingOperations = signal(0);
  private previewChange: Promise<void> = Promise.resolve();
  protected stream: MediaStream | null = null;

  readonly isLoading = computed(() => this.initialLoading() || this.pendingOperations() > 0);

  errorMessage: string | null = null;

  cameras: MediaDeviceInfo[] = [];
  microphones: MediaDeviceInfo[] = [];
  speakers: MediaDeviceInfo[] = [];

  selectedDevice: SelectedDevice = {camera: null, microphone: null, speaker: null};


  constructor(
    protected deviceManager: MediaDeviceManager,
  ) {
  }

  async ngOnInit(): Promise<void> {
    try {
      this.deviceManager.listenOnChange(async (deviceList) => this.loadDevices(deviceList));
      const list = await this.deviceManager.captureDeviceList();
      if (!this.destroyed) await this.loadDevices(list);
    } catch (err) {
      this.errorMessage = MediaDeviceError.build(err, 'media').message;
    } finally {
      this.initialLoading.set(false);
    }
  }

  async ngAfterViewInit() {
    this.viewReady = true;
    await this.tryStartStream();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopStream();
    this.deviceManager.removeOnChange();
  }

  private async loadDevices(devices: MediaDeviceList) {
    if (this.destroyed) return;
    this.cameras = Array.from(devices.cameras.values());
    this.microphones = Array.from(devices.microphones.values());
    this.speakers = Array.from(devices.speakers.values());
    this.selectedDevice = {
      camera: devices.selectedDevice?.camera ?? null,
      microphone: devices.selectedDevice?.microphone ?? null,
      speaker: devices.selectedDevice?.speaker ?? null,
    }
    await this.tryStartStream();
  }

  private async tryStartStream() {
    if (!this.viewReady) return;
    if (!this.selectedDevice.camera) return;

    await this.startStream();
  }

  startStream(): Promise<void> {
    this.pendingOperations.update(count => count + 1);
    this.previewChange = this.previewChange.then(() => this.openStream()).finally(() => {
      this.pendingOperations.update(count => count - 1);
    });
    return this.previewChange;
  }

  private async openStream(): Promise<void> {
    if (this.destroyed) return;
    this.stopStream();
    this.errorMessage = null;

    try {
      const stream = await this.deviceManager.getUserMedia(this.selectedDevice);
      if (this.destroyed) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        await this.videoElement.nativeElement.play().catch(() => {
          this.errorMessage = 'Autoplay is blocked. Please click Play.';
        });

        if (
          this.selectedDevice.speaker !== null && this.selectedDevice.speaker !== undefined &&
          'setSinkId' in this.videoElement.nativeElement
        ) {
          try {
            // @ts-ignore
            await this.videoElement.nativeElement.setSinkId(
              this.selectedDevice.speaker
            );
          } catch (err: any) {
            this.errorMessage = `Audio output could not be switched. ${err.message}`;
          }
        }
      }
    } catch (err) {
      const mediaError = MediaDeviceError.build(err, 'media');
      this.errorMessage = mediaError.message;
    }
  }

  stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  async onCameraChange(value: any): Promise<void> {
    if (this.isLoading()) return;
    this.selectedDevice.camera = value;
    await this.startStream();
  }

  async onMicrophoneChange(value: any): Promise<void> {
    if (this.isLoading()) return;
    this.selectedDevice.microphone = value;
    await this.startStream();
  }

  async onSpeakerChange(value: any): Promise<void> {
    if (this.isLoading()) return;
    this.selectedDevice.speaker = value;
    this.pendingOperations.update(count => count + 1);
    try {
      if (
        this.videoElement?.nativeElement &&
        'setSinkId' in this.videoElement.nativeElement
      ) {
        await this.videoElement.nativeElement.setSinkId(value);
      }
    } catch (err) {
      this.errorMessage = MediaDeviceError.build(err, 'media').message;
    } finally {
      this.pendingOperations.update(count => count - 1);
    }
  }

  closeModal() {
    if (this.isLoading()) return;
    this.log.info('close');
    this.onClose.emit();
  }

  select() {
    if (this.isLoading() || !this.stream) return;
    this.log.info('select');
    this.deviceManager.saveDeviceSettings(this.selectedDevice);
    this.onSelect.emit();
    this.closeModal();
  }
}
