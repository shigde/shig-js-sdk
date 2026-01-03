import {Injectable} from '@angular/core';
import {createLogger} from './logger';
import {LocalStoreService} from './local-store.service';
import {DeviceSettings, MediaDeviceList, SelectedDevice} from '../entities';
import {MediaDeviceError} from './media-device.error';

@Injectable({
  providedIn: 'root'
})
export class MediaDeviceManager {
  private readonly log = createLogger('MediaDeviceManager');
  private permissionsGranted = false;
  private abort?: AbortController;
  private processing = false;
  private queue: Array<() => Promise<void>> = [];

  constructor(private store: LocalStoreService) {
    this.log.info('init media device manager');
  }

  /**
   * Start media stream
   * this method should be used when a device has already been selected to start a stream
   *
   *  @returns MediaStream
   *
   * @throws Error if no devices are available or permission is denied.
   */
  public async sartDevice(): Promise<MediaStream> {
    this.log.info('start media stream');
    let device = this.getDeviceSettings();

    if (!device.hasSelectedDevice()) {
      this.log.info('start media stream but no selected device');
      throw new Error('no selected device');
    }

    try {
      return await this.getUserMedia(device.getSelectedDevice());
    } catch (err) {
      if (err instanceof MediaDeviceError) {
        this.log.warn('start media stream failed', err.mediaErrorType);
      } else {
        this.log.error('start media stream failed', 'unknown error');
      }
      throw err;
    }
  }

  // Device settings
  public async captureDeviceList(): Promise<MediaDeviceList> {
    let deviceSettings = this.getDeviceSettings();
    this.log.debug('get device settings', deviceSettings);

    try {
      await this.grandPermissions();
      let deviceList = await navigator.mediaDevices.enumerateDevices();
      this.log.debug('capture device list', deviceList);

      // We use maps to avoid duplicate identifiers, and we are not interested in device groups.
      const medias: MediaDeviceList = {
        cameras: new Map<string, MediaDeviceInfo>(),
        microphones: new Map<string, MediaDeviceInfo>(),
        speakers: new Map<string, MediaDeviceInfo>(),
        selectedDevice: {camera: null, microphone: null, speaker: null},
      };

      const preSelectedDevice = deviceSettings.getSelectedDevice();
      deviceSettings.clearSelectedDevice();

      for (const device of deviceList) {
        if (!device.deviceId || device.deviceId == '') {
          continue;
        }

        if (device.kind === 'videoinput' && !medias.cameras.has(device.deviceId)) {
          medias.cameras.set(device.deviceId, device);
          if (device.deviceId == preSelectedDevice.camera) {
            deviceSettings.camera = device.deviceId;
          }
        } else if (device.kind === 'audioinput' && !medias.microphones.has(device.deviceId)) {
          medias.microphones.set(device.deviceId, device);
          if (device.deviceId == preSelectedDevice.microphone) {
            deviceSettings.microphone = device.deviceId;
          }
        } else if (device.kind === 'audiooutput' && !medias.speakers.has(device.deviceId)) {
          medias.speakers.set(device.deviceId, device);
          if (device.deviceId == preSelectedDevice.speaker) {
            deviceSettings.speaker = device.deviceId;
          }
        }
      }

      // Check if the selected device is still available. If it's available, it should be in the device settings again.
      // If not, select the first available device and save it to local storage as a newly selected device.
      if (!deviceSettings.hasSelectedDevice()) {
        this.log.info('capture device list but no previous selected device, select first available device');
        deviceSettings.camera = medias.cameras.values().next().value?.deviceId;
        deviceSettings.microphone = medias.microphones.values().next().value?.deviceId;
        deviceSettings.speaker = medias.speakers.values().next().value?.deviceId;
        // update new selected device in local storage
        this.saveDeviceSettings(deviceSettings);
      }
      medias.selectedDevice = deviceSettings.getSelectedDevice();

      return medias;
    } catch (err) {
      this.log.error('capture device list failed', err);
      throw MediaDeviceError.build(err, 'media');
    }
  }

  /**
   * Get user media from the browser
   * @param settings
   * @private
   *
   * @returns MediaStream
   *
   * @throws MediaDeviceError if no devices are available or permission is denied.
   */
  public async getUserMedia(settings: SelectedDevice): Promise<MediaStream> {
    const constraints = this.getConstraintByDevice(settings);
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw MediaDeviceError.build(err, 'media');
    }
  }

  private getConstraintByDevice(settings: SelectedDevice): MediaStreamConstraints {
    return {
      audio: {deviceId: {exact: `${settings.microphone}`}},
      video: {deviceId: {exact: `${settings.camera}`}},
    };
  }

  public getDeviceSettings() {
    this.log.info('get selected device');
    let devices = this.store.loadDevicesSettings();
    return devices == null ? DeviceSettings.buildDefault() : devices;
  }

  public saveDeviceSettings(device: SelectedDevice) {
    this.log.info('save selected device', device);
    let deviceSettings = this.getDeviceSettings();
    deviceSettings.setSelectedDevice(device);
    this.store.saveDevicesSettings(deviceSettings);
  }


  /**
   * Check if the browser has permission to access the media devices.
   * If not, the user will be prompted to grant permission.
   * @returns Promise<void>
   */
  private async grandPermissions() {
    this.log.info('grandPermissions: already granted?', this.permissionsGranted);
    if (this.permissionsGranted) {
      return;
    }
    await navigator.mediaDevices.getUserMedia({audio: true, video: true}).then(stream => {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    });
    this.permissionsGranted = true;
  }

  public listenOnChange(callback: (deviceList: MediaDeviceList) => Promise<void>) {
    this.abort?.abort();
    this.queue.length = 0;

    this.abort = new AbortController();

    const enqueue = () => {
      this.queue.push(async () => {
        this.log.info('device change detected');

        try {
          const list = await this.captureDeviceList();
          await callback(list);
        } catch (e) {
          this.log.error('device change handling failed', e);
        }
      });

      this.runQueue();
    };

    navigator.mediaDevices.addEventListener(
      'devicechange',
      enqueue,
      {signal: this.abort.signal}
    );
  }

  public removeOnChange() {
    this.abort?.abort();
    this.abort = undefined;
    this.queue.length = 0;
    this.processing = false;
  }

  private async runQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        await job();
      }
    } finally {
      this.processing = false;
    }
  }
}
