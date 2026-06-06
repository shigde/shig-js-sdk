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
        let ssrcs = m.ssrcs ? m.ssrcs
          .filter(s => s.attribute === 'msid')
          .map(s => s.id) : [];
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
          muted: muted,
          ssrcs: ssrcs,
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

  static mungeAnswerCodecs(answer: RTCSessionDescription): RTCSessionDescription {
    const sdp = answer.sdp!;
    const sections = sdp.split(/\r\n(?=m=)/);

    const sessionPart = sections[0];
    const mediaParts = sections.slice(1);

    const mungedMedia = mediaParts.map(section => {
      if (section.startsWith('m=audio')) {
        return this.keepCodecs(section, codec =>
          codec.mime.toLowerCase() === 'opus'
        );
      }

      if (section.startsWith('m=video')) {
        return this.keepCodecs(section, codec =>
          codec.mime.toLowerCase() === 'h264' &&
          codec.fmtp.includes('packetization-mode=1') &&
          codec.fmtp.includes('profile-level-id=42e01f')
        );
      }

      return section;
    });

    return new RTCSessionDescription({
      type: answer.type,
      sdp: [sessionPart, ...mungedMedia].join('\r\n')
    });
  }

  private static keepCodecs(
    section: string,
    keep: (codec: { pt: string; mime: string; fmtp: string }) => boolean
  ): string {
    const lines = section.split('\r\n').filter(Boolean);

    const rtpmap = new Map<string, string>();
    const fmtp = new Map<string, string>();

    for (const line of lines) {
      let m = line.match(/^a=rtpmap:(\d+)\s+([^/]+)/i);
      if (m) rtpmap.set(m[1], m[2]);

      m = line.match(/^a=fmtp:(\d+)\s+(.+)$/i);
      if (m) fmtp.set(m[1], m[2]);
    }

    const keepPts = new Set<string>();

    for (const [pt, mime] of rtpmap) {
      if (keep({pt, mime, fmtp: fmtp.get(pt) ?? ''})) {
        keepPts.add(pt);
      }
    }

    // RTX entfernen, außer du willst retransmission behalten.
    // Für maximale Einfachheit: nur echte Ziel-Codecs behalten.
    const mLine = lines[0].split(' ');
    const header = mLine.slice(0, 3);
    const pts = mLine.slice(3).filter(pt => keepPts.has(pt));

    const newLines = lines.filter(line => {
      if (line.startsWith('m=')) return true;

      const ptMatch = line.match(/^a=(rtpmap|fmtp|rtcp-fb):(\d+)/);
      if (ptMatch) {
        return keepPts.has(ptMatch[2]);
      }

      return true;
    });

    newLines[0] = [...header, ...pts].join(' ');

    return newLines.join('\r\n');
  }

}
