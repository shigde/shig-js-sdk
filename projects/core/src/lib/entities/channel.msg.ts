export interface ChannelMsg {
    id: number;
    type: ChannelMsgType;
    data: any;
}

export enum ChannelMsgType {
    OfferMsg = 1,
    AnswerMsg,
    MuteMsg
}

export interface SdpMsgData {
    number: number;
    sdp: RTCSessionDescription;
}

export interface MuteMsgData {
    mid: string;
    mute: boolean;
}

type NegotiationMsg =
  | { type: "offer"; seq: number; sdp: string }
  | { type: "answer"; seq: number; sdp: string }
  | { type: "abort"; seq: number }
  | { type: "commit"; seq: number };
