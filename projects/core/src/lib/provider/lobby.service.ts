import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

import {WebrtcConnection} from './webrtc-connection';
import {BehaviorSubject, catchError, lastValueFrom, Observable, of, tap} from 'rxjs';
import {MessageService} from './message.service';
import {ChannelMessenger} from './channel-messenger';
import {
    ChannelMsg,
    ChannelMsgType, LobbyMedia,
    LobbyMediaPurpose,
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
    public remove$ = new BehaviorSubject<LobbyMedia | null>(null);

    httpOptions = {
        headers: new HttpHeaders({'Content-Type': 'application/sdp', 'Accept': 'application/sdp'}),
        responseType: 'text'
    };

    constructor(private http: HttpClient, private messageService: MessageService, private params: ParameterService) {
    }

    public join(stream: Map<LobbyMediaPurpose, MediaStream>, spaceId: string, streamId: string, config: RTCConfiguration): Promise<unknown> {
        return this.createSendingConnection(stream, spaceId, streamId, config)
            .then((messenger) => this.createReceivingConnection(messenger, spaceId, streamId, config));
    }


    private createSendingConnection(streams: Map<LobbyMediaPurpose, MediaStream>, spaceId: string, streamId: string, config: RTCConfiguration): Promise<ChannelMessenger> {
        const wc = new WebrtcConnection(config);
        const messenger = new ChannelMessenger(wc.createDataChannel());
        return wc.createOffer(streams)
            .then((offer) => this.sendWhip(offer, spaceId, streamId))
            .then((answer) => wc.setAnswer(answer))
            .then(() => messenger);
    }

    private createReceivingConnection(messenger: ChannelMessenger, spaceId: string, streamId: string, config: RTCConfiguration): Promise<unknown> {
        const wc = new WebrtcConnection(config);

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
        });

        wc.subscribe((event) => {
            if (event.type === 'add') {
                let stream = event.stream;
                if (stream !== undefined) {
                    console.log('###### Add track:stream', event.media.kind, event.media.trackId, stream?.id);
                    this.add$.next({media: event.media, stream});
                }
            }
            if (event.type === 'remove') {
                console.log('###### Remove track:stream', event.media.kind, event.media.trackId, event.media.streamId,);
                this.remove$.next(event.media);
            }
        });

        return this.sendWhepOfferReq(spaceId, streamId)
            .then((offer) => wc.setRemoteOffer(offer))
            .then((answer) => this.sendWhepAnswer(answer, spaceId, streamId));
    }


    sendWhip(offer: RTCSessionDescriptionInit, spaceId: string, streamId: string): Promise<RTCSessionDescription> {
        const whipUrl = `${this.params.API_PREFIX}/space/${spaceId}/stream/${streamId}/whip`;

        const body = offer.sdp;
        // @ts-ignore
        return lastValueFrom(this.http.post(whipUrl, body, this.httpOptions).pipe(
                tap(a => console.log('---', a)),
                catchError(this.handleError<string>('sendWhip', ''))
            )
        ).then(answer => ({type: 'answer', sdp: answer} as RTCSessionDescription));
    }

    sendWhepOfferReq(spaceId: string, streamId: string) {
        const whepUrl = `${this.params.API_PREFIX}/space/${spaceId}/stream/${streamId}/whep`;

        // @ts-ignore
        return lastValueFrom(this.http.post(whepUrl, null, this.httpOptions).pipe(
                tap(a => console.log('---', a)),
                catchError(this.handleError<string>('sendWhepOfferReq', ''))
            )
        ).then(offer => ({type: 'offer', sdp: offer} as RTCSessionDescription));
    }

    sendWhepAnswer(answer: RTCSessionDescriptionInit, spaceId: string, streamId: string) {
        const whepUrl = `${this.params.API_PREFIX}/space/${spaceId}/stream/${streamId}/whep`;
        const body = answer.sdp;

        // @ts-ignore
        return lastValueFrom(this.http.patch(whepUrl, body, this.httpOptions).pipe(
                tap(a => console.log('---', a)),
                catchError(this.handleError<string>('sendWhepAnswer', ''))
            )
        );
    }

    startLiveStream(streamLiveData: StreamLiveData, spaceId: string, streamId: string) {
        const startUrl = `${this.params.API_PREFIX}/space/${spaceId}/stream/${streamId}/live`;
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
        const stopUrl = `${this.params.API_PREFIX}/space/${spaceId}/stream/${streamId}/live`;
        return this.http.delete(stopUrl).pipe(catchError(this.handleError<any>('', '')));
    }

    statusLiveStream(spaceId: string, streamId: string) {
        const getUrl = `${this.params.API_PREFIX}/space/${spaceId}/stream/${streamId}/live`;
        return this.http.get<StreamLiveStatus>(getUrl).pipe(catchError(this.handleError<any>('', '')));
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

    /** Log a LobbyService message with the MessageService */
    private log(message: string) {
        this.messageService.add(`LobbyService: ${message}`);
    }
}
