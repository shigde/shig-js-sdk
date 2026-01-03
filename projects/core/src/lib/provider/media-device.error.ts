export enum MediaErrorType {
  'PERMISSION_DENIED',
  'NOT_READABLE_ERROR',
  'DEVICE_NOT_FOUND',
  'OVERCONSTRAINED_ERROR',
  'ABORTED',
  'NOT_SUPPORTED',
  'INVALID_STATE',
  'UNKNOWN_ERROR'
}

export class MediaDeviceError extends Error {
  public static build(
    err: unknown,
    type: 'media' | 'screen'
  ): MediaDeviceError {
    if (!(err instanceof DOMException)) {
      return new MediaDeviceError(
        MediaErrorType.UNKNOWN_ERROR,
        type === 'media'
          ? '<h3>The camera or microphone could not be started.</h3> Please try again or reload the page.'
          : '<h3>Screen sharing could not be started.</h3> Please try again.'
      );
    }

    switch (err.name) {
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return new MediaDeviceError(
          MediaErrorType.DEVICE_NOT_FOUND,
          (type === 'media')
            ? '<h3>No camera or microphone could be found.</h3> Please check that your devices are connected.'
            : '<h3>No screens or windows are available for sharing.</h3>'
        );

      case 'AbortError':
        return new MediaDeviceError(
          MediaErrorType.ABORTED,
          (type === 'media')
            ? '<h3>Access to the camera or microphone was aborted.</h3> Please make sure the permission request was completed'
            : '<h3>Screen sharing was aborted.</h3> You can start sharing again whenever you’re ready.'
        );

      // e.g. Webcam or microphone are already in use (the device blocked / busy)
      case 'NotReadableError':
      case 'TrackStartError':
        return new MediaDeviceError(
          MediaErrorType.NOT_READABLE_ERROR,
          (type === 'media')
            ? '<h3>The camera or microphone is already in use by another application.</h3> Restart the browser or device if the problem persists.'
            : '<h3>Screen sharing could not be started.</h3> Please allow screen recording in system settings.'
        );

      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return new MediaDeviceError(
          MediaErrorType.OVERCONSTRAINED_ERROR,
          (type === 'media')
            ? '<h3>The selected camera does not support the chosen settings.</h3> Please select a different camera or adjust the resolution.'
            : '<h3>The selected screen sharing settings are not supported.</h3>'
        );

      // e.g., permission denied
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
      case 'PermissionDismissedError':
        return new MediaDeviceError(
          MediaErrorType.PERMISSION_DENIED,
          (type === 'media')
            ? '<h3>Access to the camera or microphone was not allowed.</h3> Please check your browser permissions and try again.'
            : '<h3>Screen sharing was not allowed.</h3> Please select a window, a tab, or the entire screen.'
        );

      case 'NotSupportedError':
        return new MediaDeviceError(
          MediaErrorType.NOT_SUPPORTED,
          type === 'media'
            ? '<h3>Camera and microphone access is not supported in this browser.</h3> Please try a different browser or device.'
            : '<h3>Screen sharing is not supported in this browser.</h3> Please try using a desktop browser that supports screen sharing.'
        );

      // // e.g., started multiple times (screenshare, for example)
      case 'InvalidStateError':
        return new MediaDeviceError(
          MediaErrorType.INVALID_STATE,
          type === 'media'
            ? '<h3>The camera or microphone is already in use.</h3> Please stop the current stream before starting a new one.'
            : '<h3>Screen sharing is already active.</h3> Stop the current screen share to start a new one.'
        );

      default:
        return new MediaDeviceError(
          MediaErrorType.UNKNOWN_ERROR,
          type === 'media'
            ? '<h3>The camera or microphone could not be started.</h3> Please try again or reload the page.'
            : '<h3>Screen sharing could not be started.</h3> Please try again.'
        );
    }
  }

  constructor(public readonly mediaErrorType: MediaErrorType, msg: string) {
    super(msg);
  }
}
