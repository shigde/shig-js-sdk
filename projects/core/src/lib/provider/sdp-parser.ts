import * as sdpTransform from 'sdp-transform';
import {getMediaStreamTypeByNumber, LobbyMediaType} from '../entities';
import {SdpMediaLine} from '../entities/sdp-media-line';

export class SdpParser {

    public static mungeOfferInfo(sdp: RTCSessionDescription, info: Map<string, LobbyMediaType>): RTCSessionDescription {
        const res = sdpTransform.parse(sdp.sdp);
        res.media.forEach((m) => {
            m.description = (m.msid && info.has(m.msid))
                ? `${info.get(m.msid.trim())}`
                : `${LobbyMediaType.GUEST}`;
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
            if(m.type !== 'application') {
                const line: SdpMediaLine = {
                    mid: (m.mid !== undefined) ? Number(m.mid) : -1,
                    msid: (m.msid !== undefined) ? m.msid : '',
                    kind: (m.type === 'audio' || m.type === 'video') ? m.type : 'audio',
                    direction: (m.direction !== undefined) ? m.direction : 'inactive',
                    mediaType: SdpParser.readDescription(m.description),
                    info: SdpParser.readInfo(m.description)
                };
                mediaLines.push(line);
            }
        });
        return mediaLines;
    }

    private static  readDescription(description: string | undefined): LobbyMediaType {
        if (description === undefined) {
            return LobbyMediaType.GUEST;
        }
        return getMediaStreamTypeByNumber(Number(description.trim()));
    }

    private static  readInfo(description: string | undefined): string {
        if (description === undefined) {
            return "unknown";
        }
        return "guest";
    }
}
