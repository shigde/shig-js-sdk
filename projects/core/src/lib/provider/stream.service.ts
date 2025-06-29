import {Injectable} from '@angular/core';
import {HttpClient, HttpEventType, HttpHeaders} from '@angular/common/http';
import {MessageService} from './message.service';
import {filter, map, Observable, of, tap} from 'rxjs';
import {ApiResponse, Stream, StreamPreview} from '../entities';
import {ParameterService} from './parameter.service';

@Injectable({providedIn: 'root'})
export class StreamService {

  httpOptions = {
    headers: new HttpHeaders({'Content-Type': 'application/json'})
  };

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private params: ParameterService
  ) {
  }

  /** GET Streams from the server */
  getChannelStreamPreviewList(channelUuid: string): Observable<ApiResponse<StreamPreview[]>> {
    return this.http.get<ApiResponse<StreamPreview[]>>(`${this.params.API_PREFIX}/pub/channel/${channelUuid}/stream-preview`)
      .pipe(
        map((resp) => this.castStreamResponseList<StreamPreview>(resp))
      );
  }

  /** GET Streams from the server */
  getStreamPreviewList(): Observable<ApiResponse<StreamPreview[]>> {
    return this.http.get<ApiResponse<StreamPreview[]>>(`${this.params.API_PREFIX}/pub/stream-preview`)
      .pipe(
        map((resp) => this.castStreamResponseList<StreamPreview>(resp))
      );
  }

  getStreamPreview(uuid: string): Observable<ApiResponse<StreamPreview>> {
    return this.http.get<ApiResponse<StreamPreview>>(`${this.params.API_PREFIX}/pub/stream-preview/${uuid}`)
      .pipe(
        map((resp) => this.castStreamResponse<StreamPreview>(resp))
      );
  }


  /* GET streames whose name contains search term */
  searchStreams(term: string): Observable<ApiResponse<StreamPreview[]>> {
    if (!term.trim()) {
      // if not search term, return empty stream array.
      return of({data: [], message: 'no results found'});
    }
    return this.http.get<ApiResponse<StreamPreview[]>>(`${this.params.API_PREFIX}/pub/stream/search?name=${term}`).pipe(
      map((stream_resp) => this.castStreamResponseList<StreamPreview>(stream_resp)),
    );
  }

  //////// Stream methods //////////
  /** GET stream by id. Return `undefined` when id not found */
  getStream(uuid: string): Observable<ApiResponse<Stream>> {
    return this.http.get<ApiResponse<Stream>>(`${this.params.API_PREFIX}/stream/${uuid}`)
      .pipe(
        map((resp) => this.castStreamResponse<Stream>(resp))
      );
  }

  /** PUT: update the stream on the server */
  updateStream(stream: Stream, file: File | null, progress: {
    upload: number
  }): Observable<ApiResponse<Stream> | null> {
    return this.save('update', stream, file, progress);
  }

  /** POST: create the stream on the server */
  createStream(stream: Stream, file: File | null, progress: {
    upload: number
  }): Observable<ApiResponse<Stream> | null> {
    return this.save('create', stream, file, progress);
  }

  /** POST: add a new stream to the server */
  private save(method: 'update' | 'create', stream: Stream, file: File | null, progress: {
    upload: number
  }): Observable<ApiResponse<Stream> | null> {
    const url = `${this.params.API_PREFIX}/stream`;
    const form = new FormData();
    let json = new Blob([JSON.stringify(stream)], {type: 'application/json'});
    form.append('stream', json);
    if (file != null) {
      form.append('file', file, 'thumbnail');
    } else {
      form.append('file', new Blob(), 'thumbnail');
    }

    let httpHandler = method === 'update'
      ? this.http.put(url, form, {
        reportProgress: true,
        observe: 'events'
      })
      : this.http.post(url, form, {
        reportProgress: true,
        observe: 'events'
      });
    // returns 200 || 400
    return httpHandler.pipe(
      tap((event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          if (event.total) {
            progress.upload = Math.round((100 * event.loaded) / event.total);
          }
        } else if (event.type === HttpEventType.Response) {
          progress.upload = 100; // Ensure progress reaches 100%
        }
      }),
      filter((event: any) => event.type === HttpEventType.Response),
      map((event: any) => event.body),
    );
  }

  /** DELETE: delete the stream from the server */
  deleteStream(uuid: string): Observable<ApiResponse<string>> {
    const url = `${this.params.API_PREFIX}/stream/${uuid}`;

    return this.http.delete<ApiResponse<string>>(url, this.httpOptions);
  }

  private castStreamResponse<T extends Stream | StreamPreview>(resp: ApiResponse<T>): ApiResponse<T> {
    this.castDateTypes(resp.data);
    return resp;
  }

  private castStreamResponseList<T extends Stream | StreamPreview>(resp: ApiResponse<T[]>): ApiResponse<T[]> {
    resp.data.forEach(stream => this.castDateTypes(stream));
    return resp;
  }

  private castDateTypes(stream: Stream | StreamPreview) {
    if (typeof stream.date === 'string') {
      stream.date = new Date(stream.date + 'Z');
    }
    if (stream.start_time !== null && typeof stream.start_time === 'string') {
      stream.start_time = new Date(stream.start_time + 'Z');
    }
    if (stream.end_time !== null && typeof stream.end_time === 'string') {
      stream.end_time = new Date(stream.end_time + 'Z');
    }
  }
}
