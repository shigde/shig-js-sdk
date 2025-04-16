import {Injectable} from '@angular/core';
import {filter, map, mergeMap, Observable, tap} from 'rxjs';
import {ApiResponse, Token} from '../entities';
import {HttpClient, HttpEventType, HttpHeaders} from '@angular/common/http';
import {ParameterService} from './parameter.service';
import {SessionService} from './session.service';
import {Channel} from '../entities/channel';

@Injectable({
    providedIn: 'root'
})
export class ChannelService {

    httpOptions = {
        headers: new HttpHeaders({'Content-Type': 'application/json', 'Accept': 'application/json'}),
    };

    constructor(private http: HttpClient, private params: ParameterService, private session: SessionService) {
    }

    save(channel: Channel, progress: {upload: number}): Observable<ApiResponse<Channel>| null> {
        const httpOptions = {
            headers: new HttpHeaders({'Content-Type': 'multipart/form-data', 'Accept': 'multipart/form-data'}),
        };

        const url = `${this.params.API_PREFIX}/channel`;
        const form = new FormData();
        form.append('actor', channel.actor);
        form.append('user', channel.user);
        form.append('name', channel.name);
        form.append('description', channel.description);
        form.append('support', channel.support);
        if (channel.bannerFile) {
            form.append('bannerFile', channel.bannerFile, 'channel-banner');
        }
        form.append('public', channel.public ? 'true' : 'false');

        // returns 200 || 400
        return this.http.post<ApiResponse<Channel>>(url, form, {
            ...httpOptions,
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

    fetch(actor: string): Observable<ApiResponse<Channel>> {
        const url = `${this.params.API_PREFIX}/channel/${actor}`;
        // returns 200 || 403
        return this.http.get<ApiResponse<Channel>>(url, this.httpOptions);
    }
}
