import {Injectable} from "@angular/core";
import Konva from "konva";
import {snapdom} from "@zumer/snapdom";
import {createLogger} from "./logger";

export type StreamOverlayTile = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NameplateSnapshot = {
  image: HTMLImageElement;
  konvaImage: Konva.Image;
  width: number;
  height: number;
};

export type NameplateOverlaySize = 'A' | 'B';

export type ScoreboardState = {
  enabled: boolean;
  homeName: string;
  awayName: string;
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
  homeTextColor: string;
  awayTextColor: string;
  homeScore: number;
  awayScore: number;
  timerMode: 'up' | 'down';
  timerDuration: number;
  timerRunning: boolean;
  timerValue: number;
};

const DARK_TEAM_TEXT = '#172033';

function teamTextColor(background: string): string {
  const hex = /^#?([\da-f]{6})$/i.exec(background)?.[1];
  if (!hex) return '#fff';

  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + .05);
  const darkChannels = [0x17, 0x20, 0x33].map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const darkLuminance = .2126 * darkChannels[0] + .7152 * darkChannels[1] + .0722 * darkChannels[2];
  const darkContrast = (luminance + .05) / (darkLuminance + .05);
  return whiteContrast >= darkContrast ? '#fff' : DARK_TEAM_TEXT;
}

type NameplateStyle = {
  maxWidth: number;
  height: number;
  paddingX: number;
  borderRadius: number;
  fontSize: number;
};

@Injectable({providedIn: 'root'})
export class StreamOverlayService {
  private readonly log = createLogger('StreamOverlayService');
  private nameplateSnapshots: Map<string, NameplateSnapshot> = new Map<string, NameplateSnapshot>();
  private pendingNameplateSnapshots: Set<string> = new Set<string>();
  private nameplateEnabled = false;
  private nameplateSize: NameplateOverlaySize = 'B';
  private scoreboard: ScoreboardState = {
    enabled: false, homeName: 'Home', awayName: 'Away', homeAbbr: 'HOM', awayAbbr: 'AWY',
    homeColor: '#2463eb', awayColor: '#e33446',
    homeTextColor: '#fff', awayTextColor: '#fff',
    homeScore: 0, awayScore: 0, timerMode: 'up', timerDuration: 30 * 60, timerRunning: false, timerValue: 0,
  };
  private timerStartedAt = 0;

  getScoreboardState(): ScoreboardState {
    return {...this.scoreboard, timerValue: this.getTimerValue()};
  }

  updateScoreboard(patch: Partial<ScoreboardState>): void {
    const modeChanged = patch.timerMode !== undefined && patch.timerMode !== this.scoreboard.timerMode;
    this.scoreboard = {...this.scoreboard, ...patch};
    if (patch.homeColor !== undefined) this.scoreboard.homeTextColor = teamTextColor(patch.homeColor);
    if (patch.awayColor !== undefined) this.scoreboard.awayTextColor = teamTextColor(patch.awayColor);
    if (modeChanged) {
      this.scoreboard.timerRunning = false;
      this.scoreboard.timerValue = this.scoreboard.timerMode === 'up' ? 0 : this.scoreboard.timerDuration;
    }
    if (patch.timerDuration !== undefined && this.scoreboard.timerMode === 'down' && !this.scoreboard.timerRunning) {
      this.scoreboard.timerValue = Math.max(0, patch.timerDuration);
    }
  }

  adjustScore(team: 'home' | 'away', delta: number): void {
    const key = team === 'home' ? 'homeScore' : 'awayScore';
    this.scoreboard[key] = Math.max(0, this.scoreboard[key] + delta);
  }

  setScoreboardTimerValue(seconds: number): boolean {
    if (this.scoreboard.timerRunning) return false;
    this.scoreboard.timerValue = Math.max(0, Math.floor(seconds));
    return true;
  }

  toggleScoreboardTimer(): void {
    if (this.scoreboard.timerRunning) {
      this.scoreboard.timerValue = this.getTimerValue();
      this.scoreboard.timerRunning = false;
      return;
    }
    if (this.scoreboard.timerMode === 'down' && this.getTimerValue() <= 0) {
      this.scoreboard.timerValue = this.scoreboard.timerDuration;
    }
    this.timerStartedAt = Date.now();
    this.scoreboard.timerRunning = true;
  }

  resetScoreboardTimer(): void {
    this.scoreboard.timerRunning = false;
    this.scoreboard.timerValue = this.scoreboard.timerMode === 'up' ? 0 : this.scoreboard.timerDuration;
  }

  drawScoreboard(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const state = this.scoreboard;
    if (!state.enabled) return;
    const scale = Math.min(width / 1920, height / 1080);
    const margin = 30 * scale;
    const barHeight = 68 * scale;
    const centerWidth = 250 * scale;
    const teamWidth = 180 * scale;
    const totalWidth = teamWidth * 2 + centerWidth;
    const x = margin;
    const y = margin;
    const timerText = this.formatTimer(this.getTimerValue());

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 16 * scale;
    ctx.fillStyle = 'rgba(18,24,38,.94)';
    ctx.beginPath();
    ctx.roundRect(x, y, totalWidth, barHeight, 12 * scale);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(x, y, totalWidth, barHeight, 12 * scale);
    ctx.clip();
    ctx.fillStyle = state.homeColor;
    ctx.fillRect(x, y, teamWidth, barHeight);
    ctx.fillStyle = state.awayColor;
    ctx.fillRect(x + teamWidth + centerWidth, y, teamWidth, barHeight);
    ctx.fillStyle = '#262a42';
    ctx.fillRect(x + teamWidth, y, centerWidth, barHeight);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `700 ${20 * scale}px sans-serif`;
    ctx.fillStyle = state.homeTextColor;
    ctx.fillText((state.homeAbbr || state.homeName).slice(0, 3).toUpperCase(), x + teamWidth / 2, y + barHeight / 2);
    ctx.fillStyle = state.awayTextColor;
    ctx.fillText((state.awayAbbr || state.awayName).slice(0, 3).toUpperCase(), x + teamWidth + centerWidth + teamWidth / 2, y + barHeight / 2);
    ctx.font = `700 ${34 * scale}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(String(state.homeScore), x + teamWidth + centerWidth * .28, y + barHeight * .58);
    ctx.fillText(String(state.awayScore), x + teamWidth + centerWidth * .72, y + barHeight * .58);
    ctx.font = `600 ${18 * scale}px sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(timerText, x + teamWidth + centerWidth / 2, y + 14 * scale);
    ctx.strokeStyle = 'rgba(141,202,255,.8)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(x + teamWidth + centerWidth / 2, y + 27 * scale);
    ctx.lineTo(x + teamWidth + centerWidth / 2, y + barHeight - 12 * scale);
    ctx.stroke();
    ctx.restore();
  }

  private getTimerValue(): number {
    if (!this.scoreboard.timerRunning) return Math.max(0, this.scoreboard.timerValue);
    const elapsed = Math.floor((Date.now() - this.timerStartedAt) / 1000);
    return this.scoreboard.timerMode === 'up'
      ? this.scoreboard.timerValue + elapsed
      : Math.max(0, this.scoreboard.timerValue - elapsed);
  }

  private formatTimer(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
  }

  isNameplateEnabled(): boolean {
    return this.nameplateEnabled;
  }

  getNameplateSize(): NameplateOverlaySize {
    return this.nameplateSize;
  }

  setNameplateEnabled(enabled: boolean): void {
    this.nameplateEnabled = enabled;
  }

  setNameplateSize(size: NameplateOverlaySize): void {
    if (this.nameplateSize === size) return;

    this.nameplateSize = size;
    this.nameplateSnapshots.clear();
    this.pendingNameplateSnapshots.clear();
  }

  clear(): void {
    this.nameplateSnapshots.clear();
    this.pendingNameplateSnapshots.clear();
  }

  drawNameplate(
    name: string | undefined,
    tile: StreamOverlayTile,
    ctx: CanvasRenderingContext2D,
    onReady?: () => void,
  ): void {
    if (!this.nameplateEnabled) return;

    const displayName = name?.trim() || 'Guest';
    const cacheKey = this.getNameplateCacheKey(displayName);
    const margin = Math.min(14, Math.max(6, tile.width * 0.02));
    const snapshot = this.nameplateSnapshots.get(cacheKey);

    if (snapshot === undefined) {
      this.captureNameplate(displayName, cacheKey, onReady);
      return;
    }

    const labelWidth = snapshot.width;
    const labelHeight = snapshot.height;
    const labelX = tile.x + tile.width - labelWidth - margin;
    const labelY = tile.y + tile.height - labelHeight - margin;

    snapshot.konvaImage.x(labelX);
    snapshot.konvaImage.y(labelY);
    snapshot.konvaImage.width(labelWidth);
    snapshot.konvaImage.height(labelHeight);

    ctx.drawImage(snapshot.image, labelX, labelY, labelWidth, labelHeight);
  }

  private captureNameplate(name: string, cacheKey: string, onReady?: () => void): void {
    if (this.pendingNameplateSnapshots.has(cacheKey)) return;

    this.pendingNameplateSnapshots.add(cacheKey);

    void this.createNameplateSnapshot(name)
      .then(snapshot => this.nameplateSnapshots.set(cacheKey, snapshot))
      .catch(error => this.log.warn('Could not render nameplate overlay', error))
      .finally(() => {
        this.pendingNameplateSnapshots.delete(cacheKey);
        onReady?.();
      });
  }

  private async createNameplateSnapshot(name: string): Promise<NameplateSnapshot> {
    const element = this.createNameplateElement(name);

    document.body.appendChild(element);

    try {
      const rect = element.getBoundingClientRect();
      const image = await snapdom.toPng(element, {
        backgroundColor: 'transparent',
        cache: 'auto',
        outerShadows: false,
      });

      const konvaImage = new Konva.Image({image});

      return {
        image,
        konvaImage,
        width: rect.width,
        height: rect.height,
      };
    } finally {
      element.remove();
    }
  }

  private createNameplateElement(name: string): HTMLDivElement {
    const style = this.getNameplateStyle();
    const element = document.createElement('div');
    element.textContent = name;
    element.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:-10000px',
      'display:inline-flex',
      'align-items:center',
      `max-width:${style.maxWidth}px`,
      `height:${style.height}px`,
      `padding:0 ${style.paddingX}px`,
      'box-sizing:border-box',
      'overflow:hidden',
      'white-space:nowrap',
      'text-overflow:ellipsis',
      `border-radius:${style.borderRadius}px`,
      'background:rgba(35,45,77,0.86)',
      'color:#cfe4ff',
      `font:700 ${style.fontSize}px sans-serif`,
      `line-height:${style.height}px`,
      'pointer-events:none',
      'z-index:-1',
    ].join(';');

    return element;
  }

  private getNameplateCacheKey(name: string): string {
    return `${this.nameplateSize}:${name}`;
  }

  private getNameplateStyle(): NameplateStyle {
    if (this.nameplateSize === 'A') {
      return {
        maxWidth: 240,
        height: 54,
        paddingX: 18,
        borderRadius: 8,
        fontSize: 22,
      };
    }

    return {
      maxWidth: 320,
      height: 72,
      paddingX: 24,
      borderRadius: 10,
      fontSize: 30,
    };
  }
}
