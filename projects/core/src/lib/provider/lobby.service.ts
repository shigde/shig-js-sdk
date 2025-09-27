import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

import {WebrtcConnection} from './webrtc-connection';
import {BehaviorSubject, catchError, lastValueFrom, Observable, of, tap} from 'rxjs';
import {MessageService} from './message.service';
import {ChannelMessenger} from './channel-messenger';
import {
  ChannelMsg,
  ChannelMsgType, LobbyMedia,
  LobbyMediaPurpose, LobbyMediaStream, MuteMsgData,
  SdpMsgData,
  StreamLiveData,
  StreamLiveInfo,
  StreamLiveStatus
} from '../entities';
import {ParameterService} from './parameter.service';


@Injectable({
  providedIn: 'root'
})
export class LobbyService {
  public add$ = new BehaviorSubject<{ media: LobbyMedia, stream: MediaStream } | null>(null);
  public mute$ = new BehaviorSubject<LobbyMedia | null>(null);
  public remove$ = new BehaviorSubject<LobbyMedia | null>(null);
  private messenger: ChannelMessenger | undefined;
  private ingress: WebrtcConnection | undefined;
  private egress: WebrtcConnection | undefined;

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/sdp', 'Accept': 'application/sdp'}),
    responseType: 'text'
  };

  constructor(private http: HttpClient, private messageService: MessageService, private params: ParameterService) {
  }

  public join(stream: Map<LobbyMediaPurpose, MediaStream>, spaceId: string, streamId: string, config: RTCConfiguration, info: string): Promise<unknown> {
    return this.createSendingConnection(stream, spaceId, streamId, config, info)
      .then((messenger) => this.createReceivingConnection(messenger, spaceId, streamId, config));
  }

  private createSendingConnection(streams: Map<LobbyMediaPurpose, MediaStream>, spaceId: string, streamId: string, config: RTCConfiguration, info: string): Promise<ChannelMessenger> {
    this.ingress = new WebrtcConnection(config, 'ingress');
    const msg = new ChannelMessenger(this.ingress.createDataChannel('whip'));
    this.messenger = msg;
    return this.ingress.createOffer(streams, info)
      .then((offer) => this.sendWhip(offer, spaceId, streamId))
      .then((answer) => this.ingress?.setAnswer(answer))
      .then(() => msg);
  }

  private createReceivingConnection(messenger: ChannelMessenger, spaceId: string, streamId: string, config: RTCConfiguration): Promise<unknown> {
    const wc = new WebrtcConnection(config, 'egress');
    this.egress = wc;
    new ChannelMessenger(this.egress.createDataChannel('whep'));

    messenger.subscribe((msg) => {
      if (msg.type === ChannelMsgType.OfferMsg) {
        wc.setRemoteOffer(msg.data.sdp)
          .then((answer) => ({
            type: ChannelMsgType.AnswerMsg,
            id: msg.id,
            data: {sdp: answer, number: msg.data.number} as SdpMsgData
          }) as ChannelMsg)
          .then((answer) => messenger.send(answer));
      }
      if (msg.type === ChannelMsgType.MuteMsg) {
        wc.muteRemoteMedia(msg.data.mid, msg.data.mute);
      }
    });

    wc.subscribe((event) => {
      if (event.type === 'add') {
        let stream = event.stream;
        if (stream !== undefined) {
          console.log('###### Add track:stream', event.media.kind, event.media.trackId, event.media.streamId);
          this.add$.next({media: event.media, stream});
        }
      }
      if (event.type === 'remove') {
        console.log('###### Remove track:stream', event.media.kind, event.media.trackId, event.media.streamId,);
        this.remove$.next(event.media);
      }

      if (event.type === 'mute') {
        console.log('###### Mute track:stream', event.media.kind, event.media.trackId, event.media.streamId,);
        this.mute$.next(event.media);
      }
    });

    return this.egress.createOffer(new Map<LobbyMediaPurpose, MediaStream>(), '')
      .then((offer) => this.sendWhep(offer, spaceId, streamId))
      .then((answer) => this.egress?.setAnswer(answer));
  }


  sendWhip(offer: RTCSessionDescriptionInit, spaceId: string, streamId: string): Promise<RTCSessionDescription> {
    const whipUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/whip`;

    const body = offer.sdp;
    // @ts-ignore
    return lastValueFrom(this.http.post(whipUrl, body, this.httpOptions).pipe(
        tap(a => console.log('---', a)),
        catchError(this.handleError<string>('sendWhip', ''))
      )
    ).then(answer => ({type: 'answer', sdp: answer} as RTCSessionDescription));
  }

  sendWhep(offer: RTCSessionDescriptionInit, spaceId: string, streamId: string) {
    const whepUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/whep`;

    const body = offer.sdp;
    // @ts-ignore
    return lastValueFrom(this.http.post(whepUrl, body, this.httpOptions).pipe(
        tap(a => console.log('---', a)),
        catchError(this.handleError<string>('sendWhep', ''))
      )
    ).then(answer => ({type: 'answer', sdp: answer} as RTCSessionDescription));
  }

  sendWhepAnswer(answer: RTCSessionDescriptionInit, spaceId: string, streamId: string) {
    const whepUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/whep`;
    const body = answer.sdp;

    // @ts-ignore
    return lastValueFrom(this.http.patch(whepUrl, body, this.httpOptions).pipe(
        tap(a => console.log('---', a)),
        catchError(this.handleError<string>('sendWhepAnswer', ''))
      )
    );
  }

  startLiveStream(streamLiveData: StreamLiveData, spaceId: string, streamId: string) {
    const startUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/live`;
    const rtmpUrl = (streamLiveData.rtmpUrl) ? streamLiveData.rtmpUrl : streamLiveData.rtmpsUrl;

    const httpOptions = {
      headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'})
    };

    const body: StreamLiveInfo = {
      streamKey: `${streamLiveData.streamKey}`,
      rtmpUrl: `${rtmpUrl}`
    };

    return this.http.post(startUrl, body, httpOptions).pipe(catchError(this.handleError<any>('', '')));
  }

  stopLiveStream(spaceId: string, streamId: string) {
    const stopUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/live`;
    return this.http.delete(stopUrl).pipe(catchError(this.handleError<any>('', '')));
  }

  statusLiveStream(spaceId: string, streamId: string) {
    const getUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/live`;
    return this.http.get<StreamLiveStatus>(getUrl).pipe(catchError(this.handleError<any>('', '')));
  }


  leaveLobby(spaceId: string, streamId: string) {
    const whipUrl = `${this.params.API_PREFIX}/channel/${spaceId}/stream/${streamId}/whip`;
    return this.http.delete<any>(whipUrl).pipe(catchError(this.handleError<any>('', '')));
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   *
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      this.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  public broadcastMute(trackId: string, mute: boolean) {
    if (this.messenger === undefined) {
      return;
    }
    const mid = this.ingress?.getMid(trackId);
    if (mid !== null) {
      console.log('##############-mid', mid);
      this.messenger?.send(({
        type: ChannelMsgType.MuteMsg,
        id: 0,
        data: {mute, mid} as MuteMsgData
      }) as ChannelMsg);
    }
  }

  /** Log a LobbyService message with the MessageService */
  private log(message: string) {
    this.messageService.add(`LobbyService: ${message}`);
  }
}
