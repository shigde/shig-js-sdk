import {Injectable} from "@angular/core";
import {createLogger} from "./logger";
import {SceneNode} from "../entities";

const WIDTH = 1920;
const HEIGHT = 1080;
const DEFAULT_FPS = 30;

type Tile = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SceneNodeLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
};

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
  private audioGains: Map<string, GainNode> = new Map<string, GainNode>();
  private volumeById: Map<string, number> = new Map<string, number>();
  private silentAudioSource: ConstantSourceNode | undefined;
  private silentAudioGain: GainNode | undefined;
  private running = false;
  private renderTimerId: number | undefined;
  private canvasVideoTrack: CanvasCaptureMediaStreamTrack | undefined;

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

  start(fps = DEFAULT_FPS): void {
    if (this.running) return;
    this.running = true;
    this.startRenderTimer(fps);
  };

  stop(): void {
    this.running = false;
    this.nodes.clear();
    this.videoElements.clear();
    this.mediaStreams.clear();
    this.releaseAudio();
    this.stopRenderTimer();
    this.canvasVideoTrack = undefined;
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
        this.volumeById.delete(id);
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

  setVolume(videoId: string, volume: number): void {
    const normalizedVolume = this.clamp(volume, 0, 2);
    this.volumeById.set(videoId, normalizedVolume);
    this.audioGains.get(videoId)?.gain.setTargetAtTime(
      normalizedVolume,
      this.audioContext?.currentTime ?? 0,
      0.01,
    );
  }

  updateNodeLayout(id: string, layout: SceneNodeLayout): void {
    const node = this.nodes.get(id);
    if (node === undefined) return;

    node.x = this.clamp(layout.x, 0, 1);
    node.y = this.clamp(layout.y, 0, 1);
    node.width = this.clamp(layout.width, 0.01, 1);
    node.height = this.clamp(layout.height, 0.01, 1);
    node.zIndex = layout.zIndex ?? node.zIndex;
  }

  resetTileLayout(): void {
    const activeNodes = this.getActiveNodes();
    const tiles = this.getTileLayout(activeNodes.length, 1, 1);

    activeNodes.forEach((node, index) => {
      const tile = tiles[index];
      node.x = tile.x;
      node.y = tile.y;
      node.width = tile.width;
      node.height = tile.height;
      node.zIndex = index;
    });
  }

  getSceneLayout(): Array<SceneNodeLayout & { id: string; videoId: string; name: string; active: boolean }> {
    const activeNodes = this.getActiveNodes();
    const fallbackTiles = this.getTileLayout(activeNodes.length, 1, 1);

    return activeNodes.map((node, index) => {
      const fallbackTile = fallbackTiles[index];

      return {
        id: node.id,
        videoId: node.videoId,
        name: node.name,
        active: node.active,
        x: node.x ?? fallbackTile.x,
        y: node.y ?? fallbackTile.y,
        width: node.width ?? fallbackTile.width,
        height: node.height ?? fallbackTile.height,
        zIndex: node.zIndex,
      };
    });
  }

  getMixedStream(fps = 30): MediaStream {
    if (this.canvas === undefined) {
      return new MediaStream();
    }
    const mixedStream = this.canvas.captureStream(0);
    this.canvasVideoTrack = mixedStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
    this.startRenderTimer(fps);
    this.render();

    const mixedAudioStream = this.getMixedAudioStream();

    mixedAudioStream.getAudioTracks().forEach(track => {
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

  private startRenderTimer(fps = DEFAULT_FPS): void {
    this.stopRenderTimer();
    this.render();
    this.renderTimerId = window.setInterval(() => this.render(), 1000 / fps);
  }

  private stopRenderTimer(): void {
    if (this.renderTimerId === undefined) return;

    window.clearInterval(this.renderTimerId);
    this.renderTimerId = undefined;
  }

  private render(): void {
    if (!this.running) return;
    if (this.canvas === undefined) return;
    if (this.context === undefined) return;
    const ctx = this.context;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const activeNodes = this.getActiveNodes();

    if (activeNodes.length === 0) {
      this.drawNoVideoPlaceholder({x: 0, y: 0, width: this.canvas.width, height: this.canvas.height}, ctx);
      this.requestCanvasFrame();
      return;
    }

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const tiles = this.getTileLayout(activeNodes.length, canvasWidth, canvasHeight);

    activeNodes.forEach((node, index) => {
      this.drawNode(node, this.getNodeTile(node, tiles[index], canvasWidth, canvasHeight), ctx);
    });

    this.requestCanvasFrame();
  }

  private requestCanvasFrame(): void {
    this.canvasVideoTrack?.requestFrame();
  }

  private getActiveNodes(): SceneNode[] {
    return [...this.nodes.values()]
      .filter(node => node.active)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .slice(0, 4);
  }

  private getNodeTile(node: SceneNode, fallbackTile: Tile, width: number, height: number): Tile {
    if (
      node.x === undefined ||
      node.y === undefined ||
      node.width === undefined ||
      node.height === undefined
    ) {
      return fallbackTile;
    }

    return {
      x: node.x * width,
      y: node.y * height,
      width: node.width * width,
      height: node.height * height,
    };
  }

  private getTileLayout(count: number, w: number, h: number): Tile[] {
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
    tile: Tile,
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
    tile: Tile,
    ctx: CanvasRenderingContext2D,
  ): void {
    this.drawPlaceholderImage(tile, ctx);
  }

  private drawNoVideoPlaceholder(
    tile: Tile,
    ctx: CanvasRenderingContext2D,
  ): void {
    this.drawPlaceholderImage(tile, ctx, this.logo, this.getPrimaryColor());
  }

  private drawPlaceholderImage(
    tile: Tile,
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
    tile: Tile,
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
    tile: Tile,
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
    tile: Tile,
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

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private getMixedAudioStream(): MediaStream {
    if (this.audioContext === undefined) {
      this.audioContext = this.getAudioContext();
    }

    if (this.audioDestination === undefined) {
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      this.connectSilentAudioSource();
    }

    this.mediaStreams.forEach((stream, id) => this.connectAudioSource(id, stream));

    return this.audioDestination.stream;
  }

  private connectAudioSource(id: string, stream: MediaStream): void {
    if (stream.getAudioTracks().length === 0) return;
    if (this.audioContext === undefined || this.audioDestination === undefined) return;
    if (this.audioSources.has(id)) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    const gain = this.audioContext.createGain();
    gain.gain.value = this.volumeById.get(id) ?? 1;

    source.connect(gain);
    gain.connect(this.audioDestination);

    this.audioSources.set(id, source);
    this.audioGains.set(id, gain);
  }

  private connectSilentAudioSource(): void {
    if (this.audioContext === undefined || this.audioDestination === undefined) return;
    if (this.silentAudioSource !== undefined) return;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    gain.connect(this.audioDestination);

    const source = this.audioContext.createConstantSource();
    source.offset.value = 0;
    source.connect(gain);
    source.start();

    this.silentAudioGain = gain;
    this.silentAudioSource = source;
  }

  private disconnectAudioSource(id: string): void {
    const source = this.audioSources.get(id);
    if (source === undefined) return;

    source.disconnect();
    this.audioSources.delete(id);

    this.audioGains.get(id)?.disconnect();
    this.audioGains.delete(id);
  }

  private getAudioContext(): AudioContext {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioContextCtor();
  }

  private releaseAudio(): void {
    this.audioSources.forEach(source => source.disconnect());
    this.audioSources.clear();
    this.audioGains.forEach(gain => gain.disconnect());
    this.audioGains.clear();
    this.volumeById.clear();

    this.silentAudioSource?.stop();
    this.silentAudioSource?.disconnect();
    this.silentAudioSource = undefined;

    this.silentAudioGain?.disconnect();
    this.silentAudioGain = undefined;

    this.audioDestination?.disconnect();
    this.audioDestination = undefined;

    this.audioContext?.close();
    this.audioContext = undefined;
  }
}
