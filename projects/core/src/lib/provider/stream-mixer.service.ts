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
  private logo: HTMLImageElement | undefined;
  private context: CanvasRenderingContext2D | undefined;
  private nodes: Map<string, SceneNode> = new Map<string, SceneNode>();
  private videoElements: Map<string, HTMLVideoElement> = new Map<string, HTMLVideoElement>();
  private mediaStreams: Map<string, MediaStream> = new Map<string, MediaStream>();
  private audioContext: AudioContext | undefined;
  private audioDestination: MediaStreamAudioDestinationNode | undefined;
  private audioSources: Map<string, MediaStreamAudioSourceNode> = new Map<string, MediaStreamAudioSourceNode>();
  private running = false;
  private animationId: number = 0;

  constructor() {
  }

  init(nativeElement: HTMLCanvasElement, image: HTMLImageElement, logo?: HTMLImageElement) {
    this.canvas = nativeElement;
    this.img = image;
    this.logo = logo;
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
    this.mediaStreams.clear();
    this.releaseAudio();
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

    const stream = video.srcObject as MediaStream | null;
    if (stream) {
      this.mediaStreams.set(id, stream);
      this.connectAudioSource(id, stream);
    }
  }

  removeStream(videoId: string): void {
    for (const [id, node] of this.nodes) {
      if (node.videoId === videoId) {
        this.nodes.delete(id);
        this.videoElements.delete(videoId);
        this.mediaStreams.delete(id);
        this.disconnectAudioSource(id);
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
    const mixedStream = this.canvas.captureStream(fps);
    const mixedAudioStream = this.getMixedAudioStream();

    mixedAudioStream?.getAudioTracks().forEach(track => {
      mixedStream.addTrack(track);
    });

    return mixedStream;
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

    if (activeNodes.length === 0) {
      this.drawNoVideoPlaceholder({x: 0, y: 0, width: this.canvas.width, height: this.canvas.height}, ctx);
      this.animationId = requestAnimationFrame(() => this.render());
      return;
    }

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

    const cameraOff = node.cameraOff || node.video.classList.contains('camera-off');

    if (cameraOff) {
      this.drawMutedVideoPlaceholder(tile, ctx);
    } else if (!this.isVideoRenderable(node.video)) {
      this.drawNoVideoPlaceholder(tile, ctx);
    } else {
      this.drawVideoCover(node.video, tile, ctx);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tile.x, tile.y, tile.width, tile.height);

    this.drawIconBar(node, tile, ctx);
    this.drawNameLabel(node, tile, ctx);

    ctx.restore();
  }

  private isVideoRenderable(video: HTMLVideoElement): boolean {
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;
  }

  private drawMutedVideoPlaceholder(
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
  ): void {
    this.drawPlaceholderImage(tile, ctx);
  }

  private drawNoVideoPlaceholder(
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
  ): void {
    this.drawPlaceholderImage(tile, ctx, this.logo, this.getPrimaryColor());
  }

  private drawPlaceholderImage(
    tile: { x: number; y: number; width: number; height: number },
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | undefined = this.img,
    backgroundColor = 'rgba(60, 63, 86, 1)',
  ): void {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(tile.x, tile.y, tile.width, tile.height);

    if (image === undefined || !image.complete || !image.naturalWidth || !image.naturalHeight) {
      return;
    }

    const maxWidth = tile.width * 0.35;
    const maxHeight = tile.height * 0.35;
    const imageAspect = image.naturalWidth / image.naturalHeight;

    let width = maxWidth;
    let height = width / imageAspect;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * imageAspect;
    }

    const x = tile.x + (tile.width - width) / 2;
    const y = tile.y + (tile.height - height) / 2;

    ctx.drawImage(image, x, y, width, height);
  }

  private getPrimaryColor(): string {
    const primary = getComputedStyle(document.body).getPropertyValue('--md-sys-color-primary').trim();
    return primary || '#262a42';
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

  private getMixedAudioStream(): MediaStream | undefined {
    const streamsWithAudio = [...this.mediaStreams.entries()]
      .filter(([, stream]) => stream.getAudioTracks().length > 0);

    if (!streamsWithAudio.length) {
      return undefined;
    }

    if (this.audioContext === undefined) {
      this.audioContext = this.getAudioContext();
    }

    if (this.audioDestination === undefined) {
      this.audioDestination = this.audioContext.createMediaStreamDestination();
    }

    streamsWithAudio.forEach(([id, stream]) => {
      this.connectAudioSource(id, stream);
    });

    return this.audioDestination.stream;
  }

  private connectAudioSource(id: string, stream: MediaStream): void {
    if (stream.getAudioTracks().length === 0) return;
    if (this.audioContext === undefined || this.audioDestination === undefined) return;
    if (this.audioSources.has(id)) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.audioDestination);
    this.audioSources.set(id, source);
  }

  private disconnectAudioSource(id: string): void {
    const source = this.audioSources.get(id);
    if (source === undefined) return;

    source.disconnect();
    this.audioSources.delete(id);
  }

  private getAudioContext(): AudioContext {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioContextCtor();
  }

  private releaseAudio(): void {
    this.audioSources.forEach(source => source.disconnect());
    this.audioSources.clear();

    this.audioDestination?.disconnect();
    this.audioDestination = undefined;

    this.audioContext?.close();
    this.audioContext = undefined;
  }
}
