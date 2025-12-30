import {EventEmitter} from '@angular/core';

import {ChannelMsg, ChannelMsgType, MuteMsgData, SdpMsgData} from '../entities';
import {createLogger} from './logger';


export class ChannelMessenger extends EventEmitter<ChannelMsg> {
  private readonly log = createLogger('ChannelMessenger');

  constructor(private dc: RTCDataChannel) {
    super();
    dc.onmessage = this.onReceiveChannelMessageCallback.bind(this);
  }

  private onReceiveChannelMessageCallback(me: MessageEvent<any>): void {
    const msg = JSON.parse(new TextDecoder().decode(me.data as ArrayBuffer)) as ChannelMsg;
    this.log.info("Received message:", msg);

    if (msg?.type != null && Number(msg.type) === ChannelMsgType.OfferMsg) {
      const sdp: RTCSessionDescription = {
        type: 'offer', sdp: msg?.data.sdp
      } as RTCSessionDescription;
      const number = Number(msg.data.number);

      msg.data = {number, sdp} as SdpMsgData;
      msg.type = ChannelMsgType.OfferMsg;
      this.emit(msg);
    }

    if (msg?.type != null && Number(msg.type) === ChannelMsgType.AnswerMsg) {
      const sdp: RTCSessionDescription = {
        type: 'answer', sdp: msg?.data.sdp
      } as RTCSessionDescription;
      const number = Number(msg.data.number);

      msg.data = {number, sdp} as SdpMsgData;
      msg.type = ChannelMsgType.OfferMsg;
      this.emit(msg);
    }

    if (msg?.type != null && Number(msg.type) === ChannelMsgType.MuteMsg) {
      msg.data = msg.data as MuteMsgData;
      msg.type = ChannelMsgType.MuteMsg;

      this.emit(msg);
    }
  }

  public send(msg: ChannelMsg): void {
    if (Number(msg.type) === ChannelMsgType.OfferMsg || Number(msg.type) === ChannelMsgType.AnswerMsg) {
      msg.data.sdp = msg.data.sdp.sdp;
    }

    const json = JSON.stringify({...msg, type: msg.type.toString()});
    const bytes = new TextEncoder().encode(json);
    this.dc.send(bytes);
  }
}
