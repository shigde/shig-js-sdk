import * as sdpTransform from 'sdp-transform';
import {MediaStreamType} from '../entities';

export function mungeOfferInfo(sdp: RTCSessionDescription, info: Map<string, MediaStreamType>): RTCSessionDescription {
    const res = sdpTransform.parse(sdp.sdp);
    res.media.forEach((m) => {
        m.description = (m.msid && info.has(m.msid))
            ? `${info.get(m.msid.trim())}`
            : `${MediaStreamType.GUEST}`;
    });
    const sdpStr = sdpTransform.write(res);
    return {
        sdp: sdpStr,
        type: sdp.type
    } as RTCSessionDescription;
}

