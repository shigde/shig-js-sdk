import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, NgZone, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BehaviorSubject, combineLatest, map} from 'rxjs';
import {buildDashboard} from './connection-dashboard.model';
import {ConnectionMetrics, MetricsDirection, MetricsSample, WebrtcMetricsService} from '../../provider/webrtc-metrics.service';


@Component({
  selector: 'shig-connection-dashboard', standalone: true, imports: [CommonModule],
  templateUrl: './connection-dashboard.component.html',
  styleUrl: './connection-dashboard.component.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionDashboardComponent implements OnInit, OnDestroy {
  private readonly range$ = new BehaviorSubject(60);
  readonly dashboard$ = combineLatest([this.metrics.view$, this.range$]).pipe(map(([view, seconds]) => buildDashboard(view, seconds)));
  readonly directions: MetricsDirection[] = ['send', 'receive'];
  readonly mediaSections = [{kind: 'audio', label: 'Audio'}, {kind: 'video', label: 'Video'}] as const;
  readonly ticks = [0, 0.5, 1];
  get historySeconds(): number { return this.range$.value; }
  setRange(event: Event): void { this.range$.next(Number((event.target as HTMLSelectElement).value)); }
  @Output() dismiss = new EventEmitter<void>();
  @ViewChild('panel', {static: true}) panel!: ElementRef<HTMLElement>;
  detached = false;
  direction: MetricsDirection = 'send';
  left: number | null = null;
  top: number | null = null;
  get availableWidth(): number | null {
    return this.detached ? null : Math.max(0, window.innerWidth - (this.left ?? 8) - 8);
  }
  get availableHeight(): number | null {
    return this.detached ? null : Math.max(0, window.innerHeight - (this.top ?? 8) - 8);
  }
  theme: 'light' | 'dark' = 'light';
  private themeObserver?: MutationObserver;
  private readonly systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly syncTheme = () => {
    if (this.destroyed) return;
    const selected = document.documentElement.getAttribute('data-bs-theme');
    this.theme = selected === 'dark' || (selected !== 'light' && this.systemTheme.matches) ? 'dark' : 'light';
    if (this.popup && !this.popup.closed) this.popup.document.documentElement.setAttribute('data-bs-theme', this.theme);
    this.cdr.markForCheck();
  };
  explanation = '';
  popupError = '';
  private release?: () => void;
  private popup?: Window;
  private anchor?: Comment;

  private stopMove?: () => void;
  private destroyed = false;
  private readonly onPopupClose = () => this.zone.run(() => this.dock(false));
  private readonly onParentClose = () => this.popup?.close();

  constructor(private metrics: WebrtcMetricsService, private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.syncTheme();
    this.themeObserver = new MutationObserver(() => this.zone.run(() => this.syncTheme()));
    this.themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-bs-theme']});
    this.systemTheme.addEventListener('change', this.syncTheme);
    this.left = Math.max(8, window.innerWidth - 414);
    this.top = Math.min(100, Math.max(8, window.innerHeight - 240));
    // Keep Angular's host in its original view; only portal the owned panel DOM.
    const panel = this.panel.nativeElement;
    (panel.ownerDocument.fullscreenElement ?? panel.ownerDocument.body).appendChild(panel);
    this.release = this.metrics.observe(() => !panel.ownerDocument.hidden);
    window.addEventListener('pagehide', this.onParentClose);
  }

  @HostListener('document:fullscreenchange') mountInActiveViewport(): void {
    if (this.detached || this.destroyed) return;
    const panel = this.panel.nativeElement;
    (document.fullscreenElement ?? document.body).appendChild(panel);
    this.keepInViewport();
  }

  @HostListener('window:resize') keepInViewport(): void {
    if (this.detached) return;
    const rect = this.panel.nativeElement.getBoundingClientRect();
    this.left = Math.max(8, Math.min(this.left ?? 8, window.innerWidth - rect.width - 8));
    this.top = Math.max(8, Math.min(this.top ?? 8, window.innerHeight - rect.height - 8));
  }

  startMove(event: PointerEvent): void {
    if (this.detached || event.button !== 0) return;
    event.preventDefault();
    this.stopMove?.();
    const handle = event.currentTarget as HTMLElement;
    const rect = this.panel.nativeElement.getBoundingClientRect();
    const startX = event.clientX, startY = event.clientY;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      this.left = Math.max(8, Math.min(rect.left + next.clientX - startX, window.innerWidth - rect.width - 8));
      this.top = Math.max(8, Math.min(rect.top + next.clientY - startY, window.innerHeight - rect.height - 8));
      this.cdr.markForCheck();
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      handle.removeEventListener('lostpointercapture', end);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      this.stopMove = undefined;
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('lostpointercapture', end);
    this.stopMove = end;
  }

  moveWithKeyboard(event: KeyboardEvent): void {
    const steps: Record<string, [number, number]> = {ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20]};
    const step = steps[event.key];
    if (!step || this.detached) return;
    event.preventDefault();
    this.left = (this.left ?? 8) + step[0];
    this.top = (this.top ?? 8) + step[1];
    this.keepInViewport();
  }

  detach(): void {
    this.stopMove?.();
    if (this.popup && !this.popup.closed) { this.popup.focus(); return; }
    const popup = window.open('', '_blank', 'popup=yes,width=400,height=680');
    if (!popup) { this.popupError = 'The browser blocked the window. Please allow pop-ups for this site.'; this.cdr.markForCheck(); return; }
    const host = this.panel.nativeElement;
    const source = host.ownerDocument;
    try {
      popup.document.title = 'Connection quality · Shig';
      for (const node of source.querySelectorAll('style, link[rel="stylesheet"]')) {
        const copy = node.cloneNode(true) as HTMLElement;
        if (copy instanceof HTMLLinkElement) copy.href = (node as HTMLLinkElement).href;
        popup.document.head.appendChild(copy);
      }
      for (const attribute of ['lang', 'dir', 'data-bs-theme']) {
        const value = source.documentElement.getAttribute(attribute);
        if (value) popup.document.documentElement.setAttribute(attribute, value);
      }
      popup.document.body.className = source.body.className;
      popup.document.body.style.margin = '0';
      this.anchor = source.createComment('connection-dashboard');
      host.before(this.anchor);
      this.popup = popup;
      this.detached = true;
      this.popupError = '';
      popup.document.body.appendChild(host);
      popup.addEventListener('pagehide', this.onPopupClose);
      popup.addEventListener('beforeunload', this.onPopupClose);
      popup.focus();
      this.cdr.markForCheck();
    } catch {
      this.dock();
      popup.close();
      this.popupError = 'The dashboard window could not be opened. You can continue using the panel here.';
      this.cdr.markForCheck();
    }
  }

  dock(closeWindow = true): void {
    const popup = this.popup;
    this.popup = undefined;
    popup?.removeEventListener('pagehide', this.onPopupClose);
    popup?.removeEventListener('beforeunload', this.onPopupClose);
    if (this.anchor?.parentNode) this.anchor.replaceWith(this.panel.nativeElement);
    this.anchor = undefined;
    this.detached = false;
    if (closeWindow && popup && !popup.closed) popup.close();
    if (!this.destroyed) { this.cdr.detectChanges(); this.mountInActiveViewport(); this.cdr.markForCheck(); }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.themeObserver?.disconnect();
    this.systemTheme.removeEventListener('change', this.syncTheme);
    this.stopMove?.();
    window.removeEventListener('pagehide', this.onParentClose);
    const popup = this.popup;
    this.popup = undefined;
    popup?.removeEventListener('pagehide', this.onPopupClose);
    popup?.removeEventListener('beforeunload', this.onPopupClose);
    this.panel.nativeElement.remove();
    this.anchor?.remove();
    this.anchor = undefined;
    if (popup && !popup.closed) popup.close();
    this.release?.();
    this.range$.complete();
  }
  qualityLabel(tone: string): string { return tone === 'good' ? 'Good' : tone === 'warning' ? 'Poor' : 'Unknown'; }
  selectDirection(direction: MetricsDirection): void {
    this.direction = direction;
    this.explanation = '';
    this.panel.nativeElement.querySelectorAll<HTMLDetailsElement>('.graph').forEach(graph => graph.open = false);
  }
  tabKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.selectDirection(event.key === 'Home' ? 'send' : event.key === 'End' ? 'receive' : this.direction === 'send' ? 'receive' : 'send');
    this.panel.nativeElement.querySelector<HTMLButtonElement>(`[role="tab"][data-direction="${this.direction}"]`)?.focus();
  }
  connection(sample: MetricsSample | undefined, direction: MetricsDirection): ConnectionMetrics | undefined {
    return sample?.connections.find(connection => connection.direction === direction);
  }
}
