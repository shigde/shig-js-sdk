import {
  AfterViewInit, ChangeDetectorRef,
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

  @Input() doStreamUpdate: boolean = false;

  private viewReady = false;
  protected stream: MediaStream | null = null;

  errorMessage: string | null = null;

  cameras: MediaDeviceInfo[] = [];
  microphones: MediaDeviceInfo[] = [];
  speakers: MediaDeviceInfo[] = [];

  selectedDevice: SelectedDevice = {camera: null, microphone: null, speaker: null};


  constructor(
    protected deviceManager: MediaDeviceManager,
    private cdr: ChangeDetectorRef,
  ) {
  }

  async ngOnInit(): Promise<void> {
    this.deviceManager.listenOnChange(async (deviceList) => this.loadDevices(deviceList));
    const list = await this.deviceManager.captureDeviceList();
    await this.loadDevices(list);
    this.log.info('init', this.selectedDevice);
  }

  async ngAfterViewInit() {
    this.viewReady = true;
    await this.tryStartStream();
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.stopStream();
    this.deviceManager.removeOnChange();
  }

  private async loadDevices(devices: MediaDeviceList) {
    this.cameras = Array.from(devices.cameras.values());
    this.microphones = Array.from(devices.microphones.values());
    this.speakers = Array.from(devices.speakers.values());
    this.selectedDevice = {
      camera: devices.selectedDevice?.camera ?? null,
      microphone: devices.selectedDevice?.microphone ?? null,
      speaker: devices.selectedDevice?.speaker ?? null,
    }
    await this.tryStartStream();
    this.cdr.detectChanges();
  }

  private async tryStartStream() {
    if (!this.viewReady) return;
    if (!this.selectedDevice.camera) return;

    await this.startStream();
  }

  async startStream(): Promise<void> {
    this.stopStream();

    try {
      this.stream = await this.deviceManager.getUserMedia(this.selectedDevice);

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
            this.cdr.detectChanges();
          } catch (err: any) {
            this.errorMessage = `Audio output could not be switched. ${err.message}`;
          }
        }
      }
      this.errorMessage = null;
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
    this.selectedDevice.camera = value;
    await this.startStream();
  }

  async onMicrophoneChange(value: any): Promise<void> {
    this.selectedDevice.microphone = value;
    await this.startStream();
  }

  async onSpeakerChange(value: any): Promise<void> {
    this.selectedDevice.speaker = value;
    if (
      this.videoElement?.nativeElement &&
      'setSinkId' in this.videoElement.nativeElement
    ) {
      // @ts-ignore
      await this.videoElement.nativeElement.setSinkId(value);
    }
  }

  closeModal() {
    this.log.info('close');
    this.onClose.emit();
  }

  select() {
    this.log.info('select');
    this.deviceManager.saveDeviceSettings(this.selectedDevice);
    this.onSelect.emit();
    this.closeModal();
  }
}
