import {Injectable} from "@angular/core";
import {createLogger} from "./logger";
import {SceneNode} from "../entities";

const WIDTH = 1920;
const HEIGHT = 1080;

@Injectable({providedIn: 'root'})
export class StreamMixerService {

  private readonly log = createLogger('StreamMixerService');
  private canvas: HTMLCanvasElement | undefined;
  private img: HTMLImageElement | undefined;
  private context: CanvasRenderingContext2D | undefined;
  private nodes: Map<string, SceneNode> = new Map<string, SceneNode>();
  private videoElements: Map<string, HTMLVideoElement> = new Map<string, HTMLVideoElement>();
  private running = false;
  private animationId: number = 0;

  constructor() {
  }

  init(nativeElement: HTMLCanvasElement, image: HTMLImageElement) {
    this.canvas = nativeElement;
    this.img = image;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.context.imageSmoothingEnabled = true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.render();
  };

  stop(): void {
    this.running = false;
    this.nodes.clear();
    this.videoElements.clear();
    cancelAnimationFrame(this.animationId);
  };

  appendStream(videoId: string, name = 'Guest', id = videoId): void {
    const video = document.getElementById(videoId) as HTMLVideoElement | null;
    if (!video) {
      this.log.warn(`Video element not found: ${videoId}`);
      return;
    }

    const node: SceneNode = {
      id,
      videoId,
      video,
      name,
      muted: false,
      cameraOff: false,
      active: true,
    };

    this.nodes.set(id, node);
    this.videoElements.set(videoId, video);
  }

  removeStream(videoId: string): void {
    for (const [id, node] of this.nodes) {
      if (node.videoId === videoId) {
        this.nodes.delete(id);
        this.videoElements.delete(videoId);
        break;
      }
    }
  };

  toggleActive(active: boolean, videoId: string): void {
    for (const node of this.nodes.values()) {
      if (node.videoId === videoId) {
        node.active = active;
        return;
      }
    }
  }

  getMixedStream(fps = 30): MediaStream {
    if (this.canvas === undefined) {
      return new MediaStream();
    }
    return this.canvas.captureStream(fps);
  }

  public resizeCanvas(containerWidth: number, containerHeight: number) {
    if (this.canvas === undefined) return;
    if (this.context === undefined) return;
    const rect = this.canvas.getBoundingClientRect();

    const targetAspect = 16 / 9;

    let width = containerWidth;
    let height = width / targetAspect;

    if (height > containerHeight) {
      height = containerHeight;
      width = height * targetAspect;
    }

    this.canvas.width = Math.round(width);
    this.canvas.height = Math.round(height);

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private render(): void {
    if (!this.running) return;
    if (this.canvas === undefined) return;
    if (this.context === undefined) return;
    const ctx = this.context;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const activeNodes = [...this.nodes.values()]
      .filter(node => node.active)
      .slice(0, 4);

    const tiles = this.getTileLayout(activeNodes.length, this.canvas.width, this.canvas.height);

    activeNodes.forEach((node, index) => {
      this.drawNode(node, tiles[index], ctx);
    });

    this.animationId = requestAnimationFrame(() => this.render());
  }

  private getTileLayout(count: number, w: number, h: number): Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    if (count <= 0) return [];

    if (count === 1) {
      return [{x: 0, y: 0, width: w, height: h}];
    }

    if (count === 2) {
      return [
        {x: 0, y: 0, width: w / 2, height: h},
        {x: w / 2, y: 0, width: w / 2, height: h},
      ];
    }

    if (count === 3) {
      return [
        {x: 0, y: 0, width: w / 2, height: h / 2},
        {x: w / 2, y: 0, width: w / 2, height: h / 2},
        {x: 0, y: h / 2, width: w, height: h / 2},
      ];
    }

    return [
      {x: 0, y: 0, width: w / 2, height: h / 2},
      {x: w / 2, y: 0, width: w / 2, height: h / 2},
      {x: 0, y: h / 2, width: w / 2, height: h / 2},
      {x: w / 2, y: h / 2, width: w / 2, height: h / 2},
    ];
  }

  private drawNode(
    node: SceneNode,
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
  ): void {
    ctx.save();

    this.drawVideoCover(node.video, tile, ctx);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tile.x, tile.y, tile.width, tile.height);

    this.drawIconBar(node, tile, ctx);
    this.drawNameLabel(node, tile, ctx);

    ctx.restore();
  }

  private drawVideoCover(
    video: HTMLVideoElement,
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
  ): void {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (!sourceWidth || !sourceHeight) {
      ctx.drawImage(video, tile.x, tile.y, tile.width, tile.height);
      return;
    }

    const sourceAspect = sourceWidth / sourceHeight;
    const tileAspect = tile.width / tile.height;

    let sx = 0;
    let sy = 0;
    let sWidth = sourceWidth;
    let sHeight = sourceHeight;

    if (sourceAspect > tileAspect) {
      sWidth = sourceHeight * tileAspect;
      sx = (sourceWidth - sWidth) / 2;
    } else {
      sHeight = sourceWidth / tileAspect;
      sy = (sourceHeight - sHeight) / 2;
    }

    ctx.drawImage(
      video,
      sx,
      sy,
      sWidth,
      sHeight,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
    );
  }

  private drawIconBar(
    node: SceneNode,
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
  ): void {

    ctx.fillStyle = 'rgb(255 255 255 / 0)';
    ctx.fillRect(tile.x + 12, tile.y + 12, 76, 34);

    ctx.fillStyle = '#aadaff';
    ctx.font = '18px sans-serif';
    ctx.fillText(node.muted ? '🔇' : '🎙', tile.x + 22, tile.y + 35);
    ctx.fillText(node.cameraOff ? '🚫' : '📹', tile.x + 55, tile.y + 35);
  }

  private drawNameLabel(
    node: SceneNode,
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
  ): void {
    const labelWidth = Math.min(160, tile.width - 24);
    const labelHeight = 36;
    const labelX = tile.x + tile.width - labelWidth - 14;
    const labelY = tile.y + tile.height - labelHeight - 14;

    ctx.fillStyle = 'rgba(35,45,77,0.86)';
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 5);
    ctx.fill();

    ctx.fillStyle = '#cfe4ff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(node.name, labelX + 12, labelY + 23);
  }
}
