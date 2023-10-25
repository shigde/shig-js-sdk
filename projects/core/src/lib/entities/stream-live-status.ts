export interface StreamLiveStatus {
    status: StreamLiveStatusValue;
}

export enum StreamLiveStatusValue {
    ONLINE = 1,
    OFFLINE
}
