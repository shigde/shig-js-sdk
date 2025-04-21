import {Weekday} from './weekday';
import {Stream} from './stream';


export const streams: Stream[] = [
  {
    uuid: '11111-1111-111-111-111',
    title: 'Stream 1',
    thumbnail: '',
    description: 'Stream 1 description',
    support: 'Stream 1 support',
    date: new Date('2025-04-20T16:45:30'), // mm:hh/dd:MM:YYYY
    views: 20,
    likes: 1,
    dislikes: 2,
    licence: 1,
    repeat: Weekday.MONDAY,
    metaData: {
      streamKey: 'abs',
      rtmpUrl: null,
      rtmpsUrl: null,
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
    views: 20,
    likes: 1,
    dislikes: 2,
    licence: 1,
    repeat: null,
    metaData: {
      streamKey: 'abs',
      rtmpUrl: null,
      rtmpsUrl: null,
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
    views: 50000,
    likes: 244,
    dislikes: 100,
    licence: 1,
    repeat: null,
    metaData: {
      streamKey: 'abs',
      rtmpUrl: null,
      rtmpsUrl: null,
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
