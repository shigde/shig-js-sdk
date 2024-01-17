import * as sdpTransform from 'sdp-transform';
import {getMediaStreamTypeByNumber, LobbyMediaPurpose} from '../entities';
import {SdpMediaLine} from '../entities/sdp-media-line';

export class SdpParser {

    public static mungeOfferInfo(sdp: RTCSessionDescription, info: Map<string, LobbyMediaPurpose>): RTCSessionDescription {
        const res = sdpTransform.parse(sdp.sdp);
        res.media.forEach((m) => {
            m.description = (m.msid && info.has(m.msid))
                ? `${info.get(m.msid.trim())}`
                : `${LobbyMediaPurpose.GUEST}`;
        });
        const sdpStr = sdpTransform.write(res);
        return {
            sdp: sdpStr,
            type: sdp.type
        } as RTCSessionDescription;
    }

    public static getSdpMediaLine(sdp: RTCSessionDescription | null): SdpMediaLine[] {
        const mediaLines: SdpMediaLine[] = [];
        if (sdp === null) {
            return mediaLines;
        }
        const res = sdpTransform.parse(sdp.sdp);
        res.media.forEach((m) => {
            if (m.type !== 'application') {
                let {track, stream} = SdpParser.readMediaId(m.msid);
                let {purpose, info} = SdpParser.readDescription(m.description);
                const line: SdpMediaLine = {
                    mid: (m.mid !== undefined) ? Number(m.mid) : -1,
                    trackId: track,
                    streamId: stream,
                    kind: (m.type === 'audio' || m.type === 'video') ? m.type : 'audio',
                    direction: (m.direction !== undefined) ? m.direction : 'inactive',
                    purpose: purpose,
                    info: info
                };
                mediaLines.push(line);
            }
        });
        return mediaLines;
    }

    private static readDescription(description: string | undefined): { purpose: LobbyMediaPurpose, info: string } {
        let purpose: LobbyMediaPurpose = LobbyMediaPurpose.GUEST;
        let info: string = '';
        if (description !== undefined) {
            purpose = getMediaStreamTypeByNumber(Number(description));
        }
        return {purpose, info};
    }

    private static readMediaId(msid: string | undefined): { track: string, stream: string } {
        let stream: string = '', track: string = '';
        if (msid !== undefined) {
            const mediaIds = msid.trim().split(' ');
            if (mediaIds.length === 2) {
                stream = mediaIds[0];
                track = mediaIds[1];
            }
            if (mediaIds.length === 1) {
                track = mediaIds[0];
            }
        }
        return {track, stream};
    }
}
