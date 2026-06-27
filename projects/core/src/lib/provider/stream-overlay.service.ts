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
