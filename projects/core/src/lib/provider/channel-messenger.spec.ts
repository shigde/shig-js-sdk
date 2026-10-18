import {ChannelMsgType} from '../entities';
import {ChannelMessenger} from './channel-messenger';

class FakeDataChannel {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null = null;
  sent: Uint8Array[] = [];

  send(bytes: Uint8Array): void {
    this.sent.push(bytes);
  }

  receive(message: unknown): void {
    const bytes = new TextEncoder().encode(JSON.stringify(message));
    this.onmessage?.({data: bytes.buffer} as MessageEvent<ArrayBuffer>);
  }
}

describe('ChannelMessenger', () => {
  it('decodes host presence changes independently of signaling messages', () => {
    const dc = new FakeDataChannel();
    const messenger = new ChannelMessenger(dc as unknown as RTCDataChannel);
    const received: string[] = [];
    messenger.subscribe(msg => {
      expect(msg.type).toBe(ChannelMsgType.HostStatus);
      received.push(msg.data);
    });
    for (const status of ['waiting', 'present', 'closed']) {
      dc.receive({type: '4', data: status});
    }
    expect(received).toEqual(['waiting', 'present', 'closed']);
  });
  it('keeps offer messages as offers', done => {
    const dc = new FakeDataChannel();
    const messenger = new ChannelMessenger(dc as unknown as RTCDataChannel);

    messenger.subscribe(msg => {
      expect(msg.type).toBe(ChannelMsgType.OfferMsg);
      expect(msg.data.number).toBe(3);
      expect(msg.data.sdp.type).toBe('offer');
      expect(msg.data.sdp.sdp).toBe('v=0 offer');
      done();
    });

    dc.receive({
      type: '1',
      data: {
        number: 3,
        sdp: 'v=0 offer',
      },
    });
  });

  it('keeps answer messages as answers', done => {
    const dc = new FakeDataChannel();
    const messenger = new ChannelMessenger(dc as unknown as RTCDataChannel);

    messenger.subscribe(msg => {
      expect(msg.type).toBe(ChannelMsgType.AnswerMsg);
      expect(msg.data.number).toBe(7);
      expect(msg.data.sdp.type).toBe('answer');
      expect(msg.data.sdp.sdp).toBe('v=0 answer');
      done();
    });

    dc.receive({
      type: '2',
      data: {
        number: 7,
        sdp: 'v=0 answer',
      },
    });
  });
});
