import * as sdpTransform from 'sdp-transform';
import {MediaStreamType} from '../entities';
import {SdpMediaLine} from '../entities/sdp-media-line';

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

export function getInactiveTransceiver(sdp: RTCSessionDescription): SdpMediaLine[] {
    const res = sdpTransform.parse(sdp.sdp);
    const inactive: SdpMediaLine[] = [];
    res.media.forEach((m) => {

        // if (m.mid !== undefined) {
        //     m.type
        //     inactive.push(m.mid);
        // }
    });
    return inactive;
}
