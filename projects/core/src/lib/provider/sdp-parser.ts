import * as sdpTransform from 'sdp-transform';
import {getMediaStreamTypeByNumber, LobbyMediaPurpose, SdpMediaInfo} from '../entities';
import {SdpMediaLine} from '../entities/sdp-media-line';
import {getLobbyMediaMuted, getMuted, LobbyMediaMuted} from '../entities/lobby-media-muted';

export class SdpParser {

    public static mungeOfferInfo(sdp: RTCSessionDescription, info: Map<string, SdpMediaInfo>): RTCSessionDescription {
        const res = sdpTransform.parse(sdp.sdp);
        res.media.forEach((m) => {
            if (m.msid && info.has(m.msid)) {
                const val = info.get(m.msid);
                m.description = `${val?.purpose} ${getLobbyMediaMuted(val?.muted)} ${val?.info}`;
            } else {
                m.description = `${LobbyMediaPurpose.GUEST} ${LobbyMediaMuted.Muted} Guest`;
            }
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
                let {purpose, muted, info} = SdpParser.readDescription(m.description);
                const line: SdpMediaLine = {
                    mid: (m.mid !== undefined) ? Number(m.mid) : -1,
                    trackId: track,
                    streamId: stream,
                    kind: (m.type === 'audio' || m.type === 'video') ? m.type : 'audio',
                    direction: (m.direction !== undefined) ? m.direction : 'inactive',
                    purpose: purpose,
                    info: info,
                    muted: muted
                };
                mediaLines.push(line);
            }
        });
        return mediaLines;
    }

    private static readDescription(description: string | undefined): SdpMediaInfo {
        let purpose: LobbyMediaPurpose = LobbyMediaPurpose.GUEST;
        let muted: boolean = false;
        let info: string = 'Guest';
        if (description !== undefined) {
            const dataArray = description.split(' ');
            purpose = getMediaStreamTypeByNumber(Number(dataArray[0]));
            muted = getMuted(dataArray[1]);
            info = dataArray[2];
        }
        return {purpose, muted, info};
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
