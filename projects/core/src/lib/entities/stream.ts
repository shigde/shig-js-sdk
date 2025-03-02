import {Video} from './video';

export interface Stream {
    uuid: string;
    title: string;
    user: string;
    video?: Video;
}
