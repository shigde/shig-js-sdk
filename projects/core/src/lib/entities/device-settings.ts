import {Constraints} from './constraints';

export interface SelectValue {
  value: string;
  viewValue: string;
}

export type VideoCodecValue = 'H264' | 'v8' | 'v9';

export interface SelectVideoCodecValue extends SelectValue {
  value: VideoCodecValue;
  viewValue: string;
}

export type ResolutionValue = 'qvga' | 'vga' | 'shd' | 'hd' | 'fhd' | 'qhd';

interface SelectResolutionValue extends SelectValue {
  value: ResolutionValue;
  viewValue: string;
}

export type BandwidthValue = '256' | '512' | '1024' | '4096';

export interface SelectBandwidthValue extends SelectValue {
  value: BandwidthValue;
  viewValue: string;
}

export class DeviceSettingsOptions {
  public static readonly defaultQuality = 'vga';
  public static readonly defaultVideoCodec = 'v8';
  public static readonly defaultBandwidth = '512';

  public readonly camera: SelectValue[] = [];
  public readonly microphone: SelectValue[] = [];
  public readonly audioDevice: SelectValue[] = [];

  public readonly quality: SelectResolutionValue[] = [
    {value: 'qvga', viewValue: 'QVGA (320 x 180)'},
    {value: 'vga', viewValue: 'VGA (640 x 360)'},
    {value: 'shd', viewValue: 'SHD (960 x 540)'},
    {value: 'hd', viewValue: 'HD (1280 x 720)'},
    {value: 'fhd', viewValue: 'FHD (1980 x 1080)'},
    {value: 'qhd', viewValue: 'QHD (2560 x 1440)'}
  ];
  public readonly videoCodec: SelectVideoCodecValue[] = [
    {value: 'H264', viewValue: 'H264'},
    {value: 'v8', viewValue: 'v8'},
    {value: 'v9', viewValue: 'v9'},
  ];
  public readonly bandwidth: SelectBandwidthValue[] = [
    {value: '256', viewValue: '256kbps'},
    {value: '512', viewValue: '512kbps'},
    {value: '1024', viewValue: '1Mbps'},
    {value: '4096', viewValue: '4Mbps'}
  ];


  public addCamera(camera: SelectValue): void {
    if (!this.listHasValue(this.camera, camera.value)) {
      this.camera.push(camera);
    }
  }

  public addAudioDevice(audioDevice: SelectValue): void {
    if (!this.listHasValue(this.audioDevice, audioDevice.value)) {
      this.audioDevice.push(audioDevice);
    }
  }

  public addMicrophone(microphone: SelectValue): void {
    if (!this.listHasValue(this.microphone, microphone.value)) {
      this.microphone.push(microphone);
    }
  }

  private listHasValue(list: SelectValue[], value: string): boolean {
    return list
      .map(item => item.value === value)
      .reduce((prev, current) => (current ? current : prev), false);
  }
}

export class DeviceSettings {
  public readonly id = 1;

  constructor(
    public camera: string | null | undefined,
    public microphone: string | null | undefined,
    public audioDevice: string | null | undefined,
    public quality: ResolutionValue,
    public videoCodec: VideoCodecValue,
    public bandwidth: BandwidthValue,
    public simulcast: boolean,
    public audio: boolean,
  ) {
  }

  static buildDefault(): DeviceSettings {
    return new DeviceSettings(
      null,
      null,
      null,
      DeviceSettingsOptions.defaultQuality,
      DeviceSettingsOptions.defaultVideoCodec,
      DeviceSettingsOptions.defaultBandwidth,
      false,
      true
    );
  }

  static dbProps(): string {
    return 'id,camera,microphone,audioDevice,quality,videoCodec,bandwidth,simulcast,audio';
  }
}

