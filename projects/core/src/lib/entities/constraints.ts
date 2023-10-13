import {ResolutionValue, VideoCodecValue} from './device-settings';

export interface Constraints {
    resolution: ResolutionValue;
    codec: VideoCodecValue;
    simulcast: boolean;
    audio: DeviceConstraint | boolean;
    video: DeviceConstraint | boolean;
}

interface DeviceConstraint {
    deviceId: { exact: string } | undefined | string;
}
