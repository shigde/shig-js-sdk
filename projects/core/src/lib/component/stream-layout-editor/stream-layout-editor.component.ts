import {Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import Konva from 'konva';
import {createLogger} from "../../provider";
import {StreamMixerService} from "../../provider/stream-mixer.service";
import {NameplateOverlaySize, StreamOverlayService} from "../../provider/stream-overlay.service";

@Component({
  selector: 'shig-stream-leayout-editor',
  imports: [],
  templateUrl: './stream-layout-editor.component.html',
  styleUrl: './stream-layout-editor.component.scss',
})
export class StreamLayoutEditorComponent implements OnInit, OnDestroy {
  private static readonly STAGE_PADDING = 12;
  private readonly log = createLogger('StreamLayoutEditorComponent');
  private readonly faceImage: HTMLImageElement = new Image();
  private readonly logoImage: HTMLImageElement = new Image();

  @Input('basePath') basePath: string | undefined;

  @ViewChild("fullscreenContainer")
  fullscreenContainer!: ElementRef<HTMLElement>;
  isFullscreen = false;

  @ViewChild('canvas')
  set canvasRef(el: ElementRef<HTMLCanvasElement> | undefined) {
    if (!el) return;
    this.log.info('Canvas ready');
    this.canvas = el.nativeElement;
  }

  @ViewChild('stageContainer')
  set stageRef(el: ElementRef<HTMLDivElement> | undefined) {
    if (!el) return;
    this.stageContainer = el.nativeElement;
  }

  ready = false;
  layoutEditMode = false;
  nameOverlayEnabled = false;
  nameOverlaySize: NameplateOverlaySize = 'B';
  canvas!: HTMLCanvasElement;
  private stageContainer: HTMLDivElement | undefined;
  private stage: Konva.Stage | undefined;
  private layer: Konva.Layer | undefined;
  private transformer: Konva.Transformer | undefined;
  private layoutShapes: Map<string, Konva.Rect> = new Map<string, Konva.Rect>();
  private transformingShapeIds: Set<string> = new Set<string>();
  private syncTimerId: number | undefined;

  constructor(
    private mixer: StreamMixerService,
    private overlays: StreamOverlayService,
  ) {
  }

  async toggleFullscreen() {
    if (!document.fullscreenElement) {
      await this.fullscreenContainer.nativeElement.requestFullscreen();
      this.isFullscreen = true;
    } else {
      await document.exitFullscreen();
      this.isFullscreen = false;
    }
  }

  @HostListener('document:fullscreenchange')
  fullscreenChanged() {
    this.isFullscreen = !!document.fullscreenElement;
    this.updateStageSize();
  }

  @HostListener('window:resize')
  windowResized() {
    this.updateStageSize();
  }

  ngOnInit() {
    this.nameOverlayEnabled = this.overlays.isNameplateEnabled();
    this.nameOverlaySize = this.overlays.getNameplateSize();

    this.loadImage(this.faceImage, this.basePath + '/icons/face.svg');
    this.loadImage(this.logoImage, this.basePath + '/icons/logo.png');

    Promise.all([
      this.waitForImage(this.faceImage),
      this.waitForImage(this.logoImage),
    ]).then(() => {
      this.log.info('images loaded');
      this.mixer.init(this.canvas, this.faceImage, this.logoImage)
      this.mixer.start();
      this.initLayoutStage();
      this.startLayoutSync();
      this.log.info('Canvas mixer started');
      this.ready = true;

    });
  }

  ngOnDestroy() {
    this.mixer.stop();
    this.stopLayoutSync();
    this.stage?.destroy();
    this.stage = undefined;
    this.ready = false;
  }

  resetTileLayout(): void {
    this.mixer.resetTileLayout();
    this.transformer?.nodes([]);
    this.layoutShapes.forEach(shape => {
      shape.stopDrag();
      shape.scale({x: 1, y: 1});
    });
    this.syncLayoutStage();
    this.selectFirstLayoutShape();
  }

  toggleLayoutEditMode(): void {
    this.layoutEditMode = !this.layoutEditMode;
    this.syncLayoutStage();

    if (this.layoutEditMode) {
      this.selectFirstLayoutShape();
    } else {
      this.transformer?.nodes([]);
      this.layer?.batchDraw();
    }
  }

  toggleNameOverlay(): void {
    this.nameOverlayEnabled = !this.nameOverlayEnabled;
    this.overlays.setNameplateEnabled(this.nameOverlayEnabled);
  }

  setNameOverlaySize(size: NameplateOverlaySize): void {
    this.nameOverlaySize = size;
    this.overlays.setNameplateSize(size);
  }

  private loadImage(image: HTMLImageElement, src: string): void {
    image.src = src;
  }

  private waitForImage(image: HTMLImageElement): Promise<void> {
    if (image.complete && image.naturalWidth > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject();
    });
  }

  private initLayoutStage(): void {
    if (this.stage !== undefined) return;
    if (this.stageContainer === undefined) return;

    this.stage = new Konva.Stage({
      container: this.stageContainer,
      width: this.stageContainer.clientWidth,
      height: this.stageContainer.clientHeight,
    });

    this.layer = new Konva.Layer();
    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      keepRatio: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      borderStroke: '#8DCAFF',
      anchorFill: '#8DCAFF',
      anchorStroke: '#262a42',
    });

    this.layer.add(this.transformer);
    this.stage.add(this.layer);
    this.updateStageSize();
  }

  private startLayoutSync(): void {
    this.stopLayoutSync();
    this.syncLayoutStage();
    this.syncTimerId = window.setInterval(() => this.syncLayoutStage(), 500);
  }

  private stopLayoutSync(): void {
    if (this.syncTimerId === undefined) return;

    window.clearInterval(this.syncTimerId);
    this.syncTimerId = undefined;
  }

  private syncLayoutStage(): void {
    if (this.stage === undefined || this.layer === undefined) return;
    this.updateStageBounds();

    const stageBounds = this.getStageContentBounds();
    const layout = this.mixer.getSceneLayout().filter(node => node.active);
    const activeIds = new Set(layout.map(node => node.id));

    for (const [id, shape] of this.layoutShapes) {
      if (!activeIds.has(id)) {
        shape.destroy();
        this.layoutShapes.delete(id);
      }
    }

    layout.forEach(node => {
      let shape = this.layoutShapes.get(node.id);

      if (shape === undefined) {
        shape = this.createLayoutShape(node.id);
        this.layoutShapes.set(node.id, shape);
        this.layer?.add(shape);
      }

      if (!shape.isDragging() && !this.transformingShapeIds.has(shape.id())) {
        shape.position({
          x: stageBounds.x + node.x * stageBounds.width,
          y: stageBounds.y + node.y * stageBounds.height,
        });
        shape.size({
          width: node.width * stageBounds.width,
          height: node.height * stageBounds.height,
        });
      }

      shape.zIndex(node.zIndex ?? 0);
    });

    if (!this.layoutEditMode) {
      this.transformer?.nodes([]);
    } else if ((this.transformer?.nodes().length ?? 0) === 0) {
      this.selectFirstLayoutShape();
    }

    this.transformer?.moveToTop();
    this.layer.batchDraw();
  }

  private createLayoutShape(id: string): Konva.Rect {
    const shape = new Konva.Rect({
      id,
      x: 0,
      y: 0,
      width: 160,
      height: 90,
      draggable: true,
      stroke: '#8DCAFF',
      strokeWidth: 2,
      dash: [8, 6],
      fill: 'rgba(141, 202, 255, 0.08)',
      name: 'layout-shape',
    });

    shape.on('click tap', () => {
      this.transformer?.nodes([shape]);
      this.transformer?.moveToTop();
      this.layer?.batchDraw();
    });

    shape.on('dragmove transform', () => {
      this.updateMixerLayoutFromShape(shape);
    });

    shape.on('transformstart', () => {
      this.transformingShapeIds.add(shape.id());
    });

    shape.on('transformend', () => {
      const scaleX = shape.scaleX();
      const scaleY = shape.scaleY();

      shape.width(shape.width() * scaleX);
      shape.height(shape.height() * scaleY);
      shape.scale({x: 1, y: 1});
      this.updateMixerLayoutFromShape(shape);
      this.transformingShapeIds.delete(shape.id());
    });

    return shape;
  }

  private selectFirstLayoutShape(): void {
    if (!this.layoutEditMode) return;

    const firstShape = this.layoutShapes.values().next().value as Konva.Rect | undefined;
    if (firstShape === undefined) return;

    this.transformer?.nodes([firstShape]);
    this.transformer?.moveToTop();
    this.layer?.batchDraw();
  }

  private updateMixerLayoutFromShape(shape: Konva.Rect): void {
    if (this.stage === undefined) return;
    const stageBounds = this.getStageContentBounds();

    this.mixer.updateNodeLayout(shape.id(), {
      x: (shape.x() - stageBounds.x) / stageBounds.width,
      y: (shape.y() - stageBounds.y) / stageBounds.height,
      width: (shape.width() * shape.scaleX()) / stageBounds.width,
      height: (shape.height() * shape.scaleY()) / stageBounds.height,
      zIndex: shape.zIndex(),
    });
  }

  private updateStageSize(): void {
    if (this.stage === undefined || this.stageContainer === undefined) return;

    this.updateStageBounds();
    this.syncLayoutStage();
  }

  private updateStageBounds(): void {
    if (this.stage === undefined || this.stageContainer === undefined || this.canvas === undefined) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = this.stageContainer.parentElement?.getBoundingClientRect();
    if (parentRect === undefined) return;

    const width = canvasRect.width + StreamLayoutEditorComponent.STAGE_PADDING * 2;
    const height = canvasRect.height + StreamLayoutEditorComponent.STAGE_PADDING * 2;

    this.stageContainer.style.left = `${canvasRect.left - parentRect.left - StreamLayoutEditorComponent.STAGE_PADDING}px`;
    this.stageContainer.style.top = `${canvasRect.top - parentRect.top - StreamLayoutEditorComponent.STAGE_PADDING}px`;
    this.stageContainer.style.width = `${width}px`;
    this.stageContainer.style.height = `${height}px`;

    this.stage.size({width, height});
  }

  private getStageContentBounds(): { x: number; y: number; width: number; height: number } {
    if (this.stage === undefined) {
      return {x: 0, y: 0, width: 1, height: 1};
    }

    const padding = StreamLayoutEditorComponent.STAGE_PADDING;

    return {
      x: padding,
      y: padding,
      width: Math.max(1, this.stage.width() - padding * 2),
      height: Math.max(1, this.stage.height() - padding * 2),
    };
  }
}
