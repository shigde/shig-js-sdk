import {Injectable} from '@angular/core';
import {filter, map, mergeMap, Observable, tap} from 'rxjs';
import {ApiResponse, Channel} from '../entities';
import {HttpClient, HttpEventType, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {SessionService} from './session.service';

@Injectable({
    providedIn: 'root'
})
export class ChannelService {

    httpOptions = {
        headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
    };

    constructor(private http: HttpClient, private params: ParameterService, private session: SessionService) {
    }

    save(channel: Channel, file: File | null, progress: { upload: number }): Observable<ApiResponse<Channel> | null> {
        const httpOptions = {
            headers: new HttpHeaders({
                'Content-Type': 'multipart/form-data',
                'Accept': 'multipart/form-data',
                'Enctype': 'multipart/form-data'
            }),
        };

        const url = `${this.params.API_PREFIX}/channel`;
        const form = new FormData();
        let json = new Blob([JSON.stringify(channel)], {type: 'application/json'});
        form.append('channel', json);
        if (file != null) {
            form.append('file', file, 'banner');
        } else {
            form.append('file', new Blob(), 'banner');
        }
        // returns 200 || 400
        return this.http.put<ApiResponse<Channel>>(url, form, {
            reportProgress: true,
            observe: 'events'
        }).pipe(
            tap(event => {
                if (event.type === HttpEventType.UploadProgress) {
                    if (event.total) {
                        progress.upload = Math.round((100 * event.loaded) / event.total);
                    }
                } else if (event.type === HttpEventType.Response) {
                    progress.upload = 100; // Ensure progress reaches 100%
                    // setTimeout(() => {
                    //     this.isUploading = false; // Stop the progress indicator after a delay
                    //     // this.uploadProgress = 0; // Reset for the next upload
                    // }, 1000); // Optional delay for smoother UX
                }
            }),
            filter((event) => event.type === HttpEventType.Response),
            map((event) => event.body)
        );
    }

    fetch(channelUuid: string): Observable<ApiResponse<Channel>> {
        const url = `${this.params.API_PREFIX}/pub/channel/${channelUuid}`;
        // returns 200 || 403
        return this.http.get<ApiResponse<Channel>>(url, this.httpOptions);
    }
}
