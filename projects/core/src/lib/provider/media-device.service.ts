import {Injectable} from '@angular/core';
import {DeviceSettings, MediaDevices} from '../entities';
import {Constraints} from '../entities/constraints';

@Injectable({
  providedIn: 'root'
})
export class DeviceSettingsService {
  public getUserMedia(settings: DeviceSettings): Promise<MediaStream> {
    const constraints = this.settingsToConstraint(settings);
    return navigator.mediaDevices
      .getUserMedia(constraints)
      .catch((err: Error) => {
        throw this.handleError(err, 'media');
      });
  }

  public enumerateDevices(): Promise<MediaDevices> {
    return new Promise((pResolve, pReject) => {
      const videoDevices: MediaDeviceInfo[] = [];
      const audioDevices: MediaDeviceInfo[] = [];
      const audioOutputDevices: MediaDeviceInfo[] = [];
      navigator.mediaDevices.enumerateDevices()
        .then((devices: MediaDeviceInfo[]) => {
          for (const device of devices) {
            if (device.kind === 'videoinput') {
              videoDevices.push(device);
            } else if (device.kind === 'audioinput') {
              audioDevices.push(device);
            } else if (device.kind === 'audiooutput') {
              audioOutputDevices.push(device);
            }
          }
        })
        .then(() => {
          const data = {videoDevices, audioDevices, audioOutputDevices};
          pResolve(data);
        })
        .catch((reason: Error) => {
          const err = this.handleError(reason, 'media');
          pReject(err);
        });
    });
  }

  private handleError(err: Error, type: 'media' | 'screen'): MediaError {
    /* handle the error */
    // Media.log(err.message, type);
    let newErr;
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      // required track is missing
      newErr = new MediaError(MediaErrorType.DEVICE_NOT_FOUND, type);
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError' || err.name === 'AbortError') {
      // webcam or mic are already in use
      newErr = new MediaError(MediaErrorType.NOT_READABLE_ERROR, type);
    } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      // constraints can not be satisfied by avb. devices
      newErr = new MediaError(MediaErrorType.OVERCONSTRAINED_ERROR, type);
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError' || err.name === 'PermissionDismissedError') {
      // permission denied in browser
      newErr = new MediaError(MediaErrorType.PERMISSION_DENIED, type);
    } else if (err.name === 'TypeError') {
      // empty constraints object
      newErr = new MediaError(MediaErrorType.UNKNOWN_ERROR, type);
    } else {
      newErr = new MediaError(MediaErrorType.UNKNOWN_ERROR, type);
    }

    return newErr;
  }

  private settingsToConstraint(settings: DeviceSettings): Constraints {
    const constraints: Constraints = {
      resolution: settings.quality,
      codec: settings.videoCodec,
      simulcast: settings.simulcast,
      audio: false,
      video: false,
    };

    constraints.audio = !!settings.microphone ? {deviceId: {exact: settings.microphone}} : settings.hasAudio;
    constraints.video = !!settings.camera ? {deviceId: {exact: settings.camera}} : settings.hasVideo;

    return constraints;
  }
}


export enum MediaErrorType {
  'PERMISSION_DENIED',
  'NOT_READABLE_ERROR',
  'DEVICE_NOT_FOUND',
  'OVERCONSTRAINED_ERROR',
  'UNKNOWN_ERROR'
}

export class MediaError extends Error {
  private static mediaMessages = new Map<MediaErrorType, string>([
      [MediaErrorType.DEVICE_NOT_FOUND, 'Can\'t find the device! Please check your webcam and microphone.'],
      [MediaErrorType.NOT_READABLE_ERROR, 'The hardware or operating system, preventing the sharing of the selected source. Check whether another application is using the camera or the microphone!'],
      [MediaErrorType.OVERCONSTRAINED_ERROR, 'No compatible stream could be generated. Your desired settings are not supported by your hardware!'],
      [MediaErrorType.PERMISSION_DENIED, '<h3>Permission denied in browser</h3> Please change your browser settings and allow the App access to the webcam and the microphone!'],
      [MediaErrorType.UNKNOWN_ERROR, 'An unknown system error occurred.'],
    ],
  );
  private static screenMessages = new Map<MediaErrorType, string>([
      [MediaErrorType.DEVICE_NOT_FOUND, 'No sources of screen video are available for capture.'],
      [MediaErrorType.NOT_READABLE_ERROR, 'The hardware or operating system, preventing the sharing of the selected source.'],
      [MediaErrorType.OVERCONSTRAINED_ERROR, 'No compatible stream could be generated.'],
      [MediaErrorType.PERMISSION_DENIED, '<h3>Permission denied in browser</h3>. Please change your browser settings and allow the App access screen share source.'],
      [MediaErrorType.UNKNOWN_ERROR, 'An unknown system error occurred.'],
    ],
  );

  constructor(public mediaErrorType: MediaErrorType, type: 'media' | 'screen') {
    super((type === 'media') ? MediaError.mediaMessages.get(mediaErrorType) : MediaError.screenMessages.get(mediaErrorType));
  }
}
