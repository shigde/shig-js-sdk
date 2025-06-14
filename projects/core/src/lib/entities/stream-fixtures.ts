import {Weekday} from './weekday';
import {Stream, StreamLicence, StreamPreview, StreamProtocol} from './stream';

export const streams: Stream[] = [
  {
    uuid: '11111-1111-111-111-111',
    title: 'Stream 1',
    thumbnail: '',
    description: 'Stream 1 description',
    support: 'Stream 1 support',
    date: new Date('2025-04-20T16:45:30'), // mm:hh/dd:MM:YYYY
    start: new Date('2025-04-20T16:46:00'), // mm:hh/dd:MM:YYYY
    end: new Date('2025-04-20T17:45:30'), // mm:hh/dd:MM:YYYY
    viewer: 20,
    likes: 1,
    dislikes: 2,
    licence: StreamLicence.DEFAULT,
    isRepeating: false,
    repeat: Weekday.MONDAY,
    metaData: {
      isShig: true,
      streamKey: 'abs',
      url: '',
      protocol: StreamProtocol.RTMP,
      permanentLive: false,
      saveReplay: false,
      latencyMode: 1,
    },
    isPublic: true,
    isLive: false,
    ownerUuid: '11111-1111-111-111-111-A',
    channelUuid: '11111-1111-111-111-111-C',
    participants: ['qqqqqq'], // user's uuid
    video: null
  },
  {
    uuid: '21111-1111-111-111-111',
    title: 'Stream 2',
    thumbnail: '',
    description: 'Stream 2 description',
    support: 'Stream 2 support',
    date: new Date('2025-05-20T16:45:30'), // mm:hh/dd:MM:YYYY
    start: new Date('2025-04-20T16:46:00'), // mm:hh/dd:MM:YYYY
    end: new Date('2025-04-20T17:45:30'), // mm:hh/dd:MM:YYYY
    viewer: 20,
    likes: 1,
    dislikes: 2,
    licence: StreamLicence.DEFAULT,
    isRepeating: false,
    repeat: Weekday.MONDAY,
    metaData: {
      isShig: true,
      streamKey: 'abs',
      url: '',
      protocol: StreamProtocol.RTMP,
      permanentLive: false,
      saveReplay: false,
      latencyMode: 1,
    },
    isPublic: true,
    isLive: false,
    ownerUuid: '11111-1111-111-111-111-A',
    channelUuid: '11111-1111-111-111-111-C',
    participants: ['qqqqqq'], // user's uuid
    video: null
  },
  {
    uuid: '31111-1111-111-111-111',
    title: 'Stream 1',
    thumbnail: '',
    description: 'Stream 3 description',
    support: 'Stream 3 support',
    date: new Date('2025-04-21T11:45:30'), // mm:hhTdd:MM:YYYY
    start: new Date('2025-04-20T16:46:00'), // mm:hh/dd:MM:YYYY
    end: new Date('2025-04-20T17:45:30'), // mm:hh/dd:MM:YYYY
    viewer: 50000,
    likes: 244,
    dislikes: 100,
    licence: StreamLicence.DEFAULT,
    isRepeating: false,
    repeat: Weekday.MONDAY,
    metaData: {
      isShig: true,
      streamKey: 'abs',
      url: '',
      protocol: StreamProtocol.RTMP,
      permanentLive: false,
      saveReplay: false,
      latencyMode: 1,
    },
    isPublic: true,
    isLive: false,
    ownerUuid: '11111-1111-111-111-111-A',
    channelUuid: '1111-1111-111-111-111-C',
    participants: ['qqqqqq'], // user's uuid
    video: null
  }
];


export const streamPreviews: StreamPreview[] = [
  {
    uuid: '11111-1111-111-111-111',
    title: 'Stream 1',
    thumbnail: '',
    description: 'Stream 1 description',
    support: 'Stream 1 support',
    date: new Date('2025-04-20T16:45:30'), // mm:hh/dd:MM:YYYY
    start: new Date('2025-04-20T16:46:00'), // mm:hh/dd:MM:YYYY
    end: new Date('2025-04-20T17:45:30'), // mm:hh/dd:MM:YYYY
    viewer: 20,
    likes: 1,
    dislikes: 2,
    isLive: false,
    ownerName: 'TestUser1',
    ownerUuid: '11111-1111-111-111-111-A',
    ownerAvatar: '',
    channelName: 'channel-test_user',
    channelUuid: '11111-1111-111-111-111-C',
  },
  {
    uuid: '21111-1111-111-111-111',
    title: 'Stream 2',
    thumbnail: '',
    description: 'Stream 2 description',
    support: 'Stream 2 support',
    date: new Date('2025-05-20T16:45:30'), // mm:hh/dd:MM:YYYY
    start: new Date('2025-04-20T16:46:00'), // mm:hh/dd:MM:YYYY
    end: new Date('2025-04-20T17:45:30'), // mm:hh/dd:MM:YYYY
    viewer: 20,
    likes: 1,
    dislikes: 2,
    isLive: false,
    ownerName: 'TestUser1',
    ownerUuid: '11111-1111-111-111-111-A',
    ownerAvatar: '',
    channelName: 'channel-test_user',
    channelUuid: '11111-1111-111-111-111-C',
  },
  {
    uuid: '31111-1111-111-111-111',
    title: 'Stream 1',
    thumbnail: '',
    description: 'Stream 3 description',
    support: 'Stream 3 support',
    date: new Date('2025-04-21T11:45:30'), // mm:hhTdd:MM:YYYY
    start: new Date('2025-04-20T16:46:00'), // mm:hh/dd:MM:YYYY
    end: new Date('2025-04-20T17:45:30'), // mm:hh/dd:MM:YYYY
    viewer: 50000,
    likes: 244,
    dislikes: 100,
    isLive: false,
    ownerName: 'TestUser1',
    ownerUuid: '11111-1111-111-111-111-A',
    ownerAvatar: '',
    channelName: 'channel-test_user',
    channelUuid: '11111-1111-111-111-111-C',
  }
];
