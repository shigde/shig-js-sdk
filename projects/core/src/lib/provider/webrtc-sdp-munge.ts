import * as sdpTransform from 'sdp-transform';
import {MediaStreamType} from '../entities';

export function mungeOfferInfo(sdp: RTCSessionDescription, info: Map<string, MediaStreamType>): RTCSessionDescription {
    const res = sdpTransform.parse(sdp.sdp);
    res.media.forEach((m) => {
        let streamID : string | undefined
        if(m.msid) {
            const ids = m.msid.split(' ', 2)
            streamID = ids[0]
        }
        m.description = (streamID) && info.has(streamID)? `${info.get(streamID)}` : `${MediaStreamType.GUEST}`;
    });
    const sdpStr = sdpTransform.write(res);
    return {
        sdp: sdpStr,
        type: sdp.type
    } as RTCSessionDescription;
}

