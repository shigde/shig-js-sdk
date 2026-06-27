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

@Injectable({providedIn: 'root'})
export class StreamOverlayService {
  private readonly log = createLogger('StreamOverlayService');
  private nameplateSnapshots: Map<string, NameplateSnapshot> = new Map<string, NameplateSnapshot>();
  private pendingNameplateSnapshots: Set<string> = new Set<string>();

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
    const displayName = name?.trim() || 'Guest';
    const margin = Math.min(14, Math.max(6, tile.width * 0.02));
    const snapshot = this.nameplateSnapshots.get(displayName);

    if (snapshot === undefined) {
      this.captureNameplate(displayName, onReady);
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

  private captureNameplate(name: string, onReady?: () => void): void {
    if (this.pendingNameplateSnapshots.has(name)) return;

    this.pendingNameplateSnapshots.add(name);

    void this.createNameplateSnapshot(name)
      .then(snapshot => this.nameplateSnapshots.set(name, snapshot))
      .catch(error => this.log.warn('Could not render nameplate overlay', error))
      .finally(() => {
        this.pendingNameplateSnapshots.delete(name);
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
    const element = document.createElement('div');
    element.textContent = name;
    element.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:-10000px',
      'display:inline-flex',
      'align-items:center',
      'max-width:320px',
      'height:72px',
      'padding:0 24px',
      'box-sizing:border-box',
      'overflow:hidden',
      'white-space:nowrap',
      'text-overflow:ellipsis',
      'border-radius:10px',
      'background:rgba(35,45,77,0.86)',
      'color:#cfe4ff',
      'font:700 30px sans-serif',
      'line-height:72px',
      'pointer-events:none',
      'z-index:-1',
    ].join(';');

    return element;
  }
}
