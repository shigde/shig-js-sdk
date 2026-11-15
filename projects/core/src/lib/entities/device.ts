export interface Device {
  uuid: string;
  name: string;
  slot: number;
  active: boolean;
}

export interface DeviceInvite {
  url: string;
}

export interface DeviceSession {
  token: string;
  deviceName: string;
  streamUuid: string;
}

