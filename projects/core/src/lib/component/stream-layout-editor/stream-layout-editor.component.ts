import {AfterViewChecked, ChangeDetectorRef, Component, ElementRef, HostListener, Input, TemplateRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import Konva from 'konva';
import {createLogger} from "../../provider";
import {PictureInPicture, SceneChoice, StreamMixerService} from "../../provider/stream-mixer.service";
import {ScoreboardState, StreamOverlayService} from '../../provider/stream-overlay.service';
import {StreamSettingsService} from '../../provider/stream-settings.service';
import {ScenePreferences} from '../../entities';
import {take} from 'rxjs';

@Component({
  selector: 'shig-stream-leayout-editor',
  imports: [NgTemplateOutlet],
  templateUrl: './stream-layout-editor.component.html',
  styleUrl: './stream-layout-editor.component.scss',
})
export class StreamLayoutEditorComponent implements OnInit, OnDestroy, AfterViewChecked {
  private static readonly STAGE_PADDING = 12;
  private readonly log = createLogger('StreamLayoutEditorComponent');
  private readonly faceImage: HTMLImageElement = new Image();
  private readonly logoImage: HTMLImageElement = new Image();

  @Input() previewControls?: TemplateRef<unknown>;
  @Input() streamUuid?: string;
  private _inLobby = false;
  @Input() set inLobby(value: boolean) {
    this._inLobby = value;
    this.overlays.setRenderingEnabled(value);
  }
  get inLobby(): boolean { return this._inLobby; }
  scoreboard: ScoreboardState;

  @Input('basePath') basePath: string | undefined;

  @ViewChild("fullscreenContainer")
  fullscreenContainer!: ElementRef<HTMLElement>;
  @ViewChild('sceneBar') sceneBar?: ElementRef<HTMLElement>;
  @ViewChild('scoreboardWidget') scoreboardWidget?: ElementRef<HTMLElement>;
  isFullscreen = false;
  scoreboardControlsCollapsed = false;
  scoreboardControlPosition?: {left: number; top: number};

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
  activeScene = 1;
  sceneMenuOpen = false;
  sceneChoices: Array<SceneChoice | undefined> = [undefined, {kind: 'picture-in-picture'}, undefined, undefined];
  pictureInPicture: PictureInPicture | undefined;
  mainVideoId = '';
  insetVideoId = '';
  canvas!: HTMLCanvasElement;
  private stageContainer: HTMLDivElement | undefined;
  private stage: Konva.Stage | undefined;
  private layer: Konva.Layer | undefined;
  private transformer: Konva.Transformer | undefined;
  private layoutShapes: Map<string, Konva.Rect> = new Map<string, Konva.Rect>();
  private transformingShapeIds: Set<string> = new Set<string>();
  private syncTimerId: number | undefined;
  private scoreboardRefreshId: number | undefined;
  private scoreboardDrag?: {pointerId: number; offsetX: number; offsetY: number};
  private scoreboardPositionInitialized = false;

  constructor(
    private mixer: StreamMixerService,
    private overlays: StreamOverlayService,
    private streamSettings: StreamSettingsService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.scoreboard = this.overlays.getScoreboardState();
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement !== this.fullscreenContainer.nativeElement) {
        await this.fullscreenContainer.nativeElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      this.log.warn('Could not change fullscreen mode', error);
    }
  }

  @HostListener('document:fullscreenchange')
  fullscreenChanged() {
    this.isFullscreen = document.fullscreenElement === this.fullscreenContainer.nativeElement;
    this.updateStageSize();
    this.clampScoreboardCardPosition();
  }

  @HostListener('window:resize')
  windowResized() {
    this.updateStageSize();
    this.clampScoreboardCardPosition();
  }

  @HostListener('document:pointerdown', ['$event'])
  closeSceneMenuOutside(event: PointerEvent): void {
    if (this.sceneMenuOpen && !this.sceneBar?.nativeElement.contains(event.target as Node)) {
      this.sceneMenuOpen = false;
    }
  }

  ngOnInit() {
    this.scoreboardRefreshId = window.setInterval(() => this.refreshScoreboard(), 1000);
    this.loadUserSettings();
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
    this.overlays.setRenderingEnabled(false);
    this.mixer.setScene(undefined);
    this.mixer.stop();
    this.stopLayoutSync();
    if (this.scoreboardRefreshId !== undefined) window.clearInterval(this.scoreboardRefreshId);
    this.stage?.destroy();
    this.stage = undefined;
    this.ready = false;
  }

  ngAfterViewChecked(): void {
    if (this.scoreboardPositionInitialized || !this.scoreboardWidget) return;
    this.scoreboardPositionInitialized = true;
    window.setTimeout(() => this.initializeScoreboardControlPosition(), 0);
  }

  refreshScoreboard(): void {
    this.scoreboard = this.overlays.getScoreboardState();
  }

  adjustScore(team: 'home' | 'away', delta: number): void {
    this.overlays.adjustScore(team, delta);
    this.refreshScoreboard();
  }

  toggleScoreboardTimer(): void {
    this.overlays.toggleScoreboardTimer();
    this.refreshScoreboard();
  }

  onScoreboardTimerValueChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    const match = /^(\d{1,3}):([0-5]\d)$/.exec(value);
    if (!match || this.scoreboard.timerRunning) {
      input.value = this.scoreboardTimerDisplay;
      return;
    }
    this.overlays.setScoreboardTimerValue(Number(match[1]) * 60 + Number(match[2]));
    this.refreshScoreboard();
  }

  get scoreboardTimerDisplay(): string {
    const seconds = Math.max(0, Math.floor(this.scoreboard.timerValue));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  startScoreboardCardDrag(event: PointerEvent): void {
    const widget = this.scoreboardWidget?.nativeElement;
    if (!widget || event.button !== 0 || (event.target as HTMLElement).closest('button, input, select, textarea')) return;

    const widgetRect = widget.getBoundingClientRect();
    this.scoreboardControlPosition = {
      left: widgetRect.left,
      top: widgetRect.top,
    };
    this.scoreboardDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - widgetRect.left,
      offsetY: event.clientY - widgetRect.top,
    };
    event.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  moveScoreboardCard(event: PointerEvent): void {
    if (!this.scoreboardDrag || event.pointerId !== this.scoreboardDrag.pointerId) return;
    const widget = this.scoreboardWidget?.nativeElement;
    if (!widget) return;

    const maxLeft = Math.max(0, window.innerWidth - widget.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - widget.offsetHeight);
    this.scoreboardControlPosition = {
      left: Math.min(maxLeft, Math.max(0, event.clientX - this.scoreboardDrag.offsetX)),
      top: Math.min(maxTop, Math.max(0, event.clientY - this.scoreboardDrag.offsetY)),
    };
  }

  @HostListener('document:pointerup', ['$event'])
  endScoreboardCardDrag(event: PointerEvent): void {
    if (event.pointerId !== this.scoreboardDrag?.pointerId) return;
    this.scoreboardDrag = undefined;
    this.persistScoreboardControlPosition();
  }

  @HostListener('document:pointercancel', ['$event'])
  cancelScoreboardCardDrag(event: PointerEvent): void {
    this.endScoreboardCardDrag(event);
  }

  private clampScoreboardCardPosition(): void {
    const widget = this.scoreboardWidget?.nativeElement;
    if (!widget || !this.scoreboardControlPosition) return;
    this.scoreboardControlPosition = {
      left: Math.min(Math.max(0, window.innerWidth - widget.offsetWidth), Math.max(0, this.scoreboardControlPosition.left)),
      top: Math.min(Math.max(0, window.innerHeight - widget.offsetHeight), Math.max(0, this.scoreboardControlPosition.top)),
    };
  }

  private initializeScoreboardControlPosition(): void {
    const widget = this.scoreboardWidget?.nativeElement;
    if (!widget) {
      this.scoreboardPositionInitialized = false;
      return;
    }

    let savedPosition: {left: number; top: number} | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(this.getScoreboardPositionKey()) ?? 'null');
      if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
        savedPosition = {left: saved.left, top: saved.top};
      }
    } catch {
      savedPosition = undefined;
    }

    this.scoreboardControlPosition = savedPosition ?? {
      left: Math.max(0, (window.innerWidth - widget.offsetWidth) / 2),
      top: Math.max(0, (window.innerHeight - widget.offsetHeight) / 2),
    };
    this.clampScoreboardCardPosition();
  }

  private persistScoreboardControlPosition(): void {
    if (!this.scoreboardControlPosition) return;
    try {
      localStorage.setItem(this.getScoreboardPositionKey(), JSON.stringify(this.scoreboardControlPosition));
    } catch (error) {
      this.log.warn('Could not save scoreboard controls position', error);
    }
  }

  private getScoreboardPositionKey(): string {
    return `shig-scoreboard-controls-${this.streamUuid ?? 'default'}`;
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

  get sceneVideos(): Array<{id: string; name: string}> {
    return this.mixer.getSceneVideos();
  }

  get sceneSlots(): Array<{id: string; label: string}> {
    const labels = ['Me', 'Guest 1', 'Guest 2', 'Guest 3'];
    return labels.map((label, index) => {
      const video = this.mixer.getSceneSlot(index);
      const name = video?.name?.trim();
      return {id: `slot-${index}`, label: video
        ? name && name.toLowerCase() !== label.toLowerCase() ? `${label} · ${name}` : label
        : `${label} · Empty`};
    });
  }

  sceneReady(scene: number): boolean {
    if (scene === 1) return true;
    const choice = this.sceneChoices[scene - 1];
    if (choice?.kind === 'picture-in-picture') {
      const preset = this.pictureInPicture;
      if (!preset) return false;
      const mainId = this.resolveVideoId(preset.mainId, preset.mainName);
      const insetId = this.resolveVideoId(preset.insetId, preset.insetName);
      return !!mainId && !!insetId && this.mixer.isSceneSourceActive(mainId)
        && this.mixer.isSceneSourceActive(insetId);
    }
    if (choice?.kind === 'video') return this.mixer.isSceneSourceActive(
      this.resolveVideoId(choice.videoId, choice.videoName) ?? '');
    return false;
  }

  get pictureInPictureReady(): boolean {
    const preset = this.pictureInPicture;
    return !!preset && preset.mainId !== preset.insetId;
  }

  sceneLabel(scene: number): string {
    const choice = this.sceneChoices[scene - 1];
    if (choice?.kind === 'picture-in-picture') return 'picture in picture';
    if (choice?.kind === 'video') {
      return this.sceneSlots.find(slot => slot.id === this.sceneValue(scene))?.label ?? 'Empty';
    }
    return 'Empty';
  }

  get savedMainVideoId(): string {
    return this.slotValue(this.mainVideoId, this.pictureInPicture?.mainName);
  }

  get savedInsetVideoId(): string {
    return this.slotValue(this.insetVideoId, this.pictureInPicture?.insetName);
  }

  chooseScene(scene: number): void {
    this.sceneMenuOpen = false;
    this.activeScene = scene;
    this.mixer.setScene(this.sceneChoices[scene - 1], this.pictureInPicture);
    this.syncLayoutStage();
  }

  assignScene(scene: number, value: string): void {
    this.sceneChoices[scene - 1] = !value ? undefined : value === 'picture-in-picture'
      ? {kind: 'picture-in-picture'}
      : {kind: 'video', videoId: value};
    this.saveScenes();
    if (this.activeScene === scene) {
      if (this.sceneReady(scene)) {
        this.mixer.setScene(this.sceneChoices[scene - 1], this.pictureInPicture);
        this.syncLayoutStage();
      } else {
        this.chooseScene(1);
      }
    }
  }

  sceneValue(scene: number): string {
    const choice = this.sceneChoices[scene - 1];
    return choice?.kind === 'picture-in-picture' ? choice.kind
      : choice?.kind === 'video'
        ? this.slotValue(choice.videoId, choice.videoName)
        : '';
  }

  setPictureInPictureSlot(slot: 'main' | 'inset', value: string): void {
    const otherValue = slot === 'main' ? this.insetVideoId : this.mainVideoId;
    if (value && value === otherValue) return;
    if (slot === 'main') this.mainVideoId = value;
    else this.insetVideoId = value;

    if (!this.mainVideoId || !this.insetVideoId) {
      const hadSavedPictureInPicture = this.pictureInPicture !== undefined;
      this.pictureInPicture = undefined;
      if (hadSavedPictureInPicture) this.saveScenes();
      if (this.sceneChoices[this.activeScene - 1]?.kind === 'picture-in-picture') this.chooseScene(1);
      return;
    }

    const previous = this.mixer.getPictureInPicture() ?? this.pictureInPicture ?? this.defaultPictureInPicture();
    this.pictureInPicture = {mainId: this.mainVideoId, insetId: this.insetVideoId,
      x: previous?.x ?? 0.72, y: previous?.y ?? 0.04,
      width: previous?.width ?? 0.25, height: previous?.height ?? 0.25};
    this.saveScenes();
    if (this.sceneChoices[this.activeScene - 1]?.kind === 'picture-in-picture') this.chooseScene(this.activeScene);
  }

  private slotValue(id: string, name?: string): string {
    if (/^slot-[0-3]$/.test(id)) return id;
    const index = this.sceneSlots.findIndex((_, slot) => {
      const video = this.mixer.getSceneSlot(slot);
      return video?.id === id || (!!name && video?.name === name);
    });
    return index < 0 ? '' : `slot-${index}`;
  }

  private resolveVideoId(id: string, name?: string): string | undefined {
    if (/^slot-[0-3]$/.test(id)) return this.mixer.getSceneSlot(Number(id.slice(-1)))?.id;
    return this.sceneVideos.find(video => video.id === id || (!!name && video.name === name))?.id;
  }

  private saveScenes(): void {
    const scenes: ScenePreferences = {
      choices: this.sceneChoices.slice(1).map(choice => choice ?? null),
      pictureInPicture: this.pictureInPicture ? {
        mainId: this.slotValue(this.pictureInPicture.mainId),
        insetId: this.slotValue(this.pictureInPicture.insetId),
        x: this.pictureInPicture.x, y: this.pictureInPicture.y,
        width: this.pictureInPicture.width, height: this.pictureInPicture.height,
      } : null,
    };
    this.streamSettings.saveScenes(scenes).pipe(take(1)).subscribe({
      error: error => this.log.warn('Could not save user scene settings', error),
    });
  }

  private loadUserSettings(): void {
    this.streamSettings.get().pipe(take(1)).subscribe({
      next: saved => {
        this.overlays.applyScoreboardPreferences(saved.scoreboard);
        this.sceneChoices = [undefined, ...saved.scenes.choices.map(choice => choice ?? undefined)];
        this.pictureInPicture = saved.scenes.pictureInPicture ?? undefined;
        this.mainVideoId = this.pictureInPicture?.mainId ?? '';
        this.insetVideoId = this.pictureInPicture?.insetId ?? '';
        this.refreshScoreboard();
        this.cdr.markForCheck();
      },
      error: error => this.log.warn('Could not load user stream settings', error),
    });
  }

  private defaultPictureInPicture(): PictureInPicture {
    return {mainId: 'slot-0', insetId: 'slot-1', x: 0.72, y: 0.04, width: 0.25, height: 0.25};
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
