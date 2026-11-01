import {AfterViewInit, Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, TemplateRef, ViewChild, ViewContainerRef} from '@angular/core';
import {CdkOverlayOrigin, GlobalPositionStrategy, Overlay, OverlayModule, OverlayRef} from '@angular/cdk/overlay';
import {A11yModule} from '@angular/cdk/a11y';
import {TemplatePortal} from '@angular/cdk/portal';
import {Subscription} from 'rxjs';

export interface SettingsTab {
  id: string;
  label: string;
  icon: string;
}

let nextPanelId = 0;

@Component({
  selector: 'shig-settings-panel',
  standalone: true,
  imports: [OverlayModule, A11yModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss',
})
export class SettingsPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({required: true}) origin!: CdkOverlayOrigin;
  @Input() open = false;
  @Input() heading = 'Settings';
  @Input() subtitle = '';
  @Input() tabs: SettingsTab[] = [];
  @Input() activeTab = '';
  @Output() openChange = new EventEmitter<boolean>();
  @Output() activeTabChange = new EventEmitter<string>();

  readonly panelId = `shig-settings-${nextPanelId++}`;
  @ViewChild('panelTemplate', {static: true}) private panelTemplate!: TemplateRef<unknown>;
  private overlayRef?: OverlayRef;
  private position?: GlobalPositionStrategy;
  private initialized = false;
  private subscriptions = new Subscription();

  constructor(private overlay: Overlay, private viewContainer: ViewContainerRef) {}

  ngAfterViewInit(): void {
    this.initialized = true;
    this.syncOverlay();
  }

  ngOnChanges(): void {
    if (this.initialized) this.syncOverlay();
  }

  private syncOverlay(): void {
    if (!this.open) {
      this.overlayRef?.detach();
      return;
    }
    if (!this.overlayRef) {
      this.position = this.overlay.position().global().centerHorizontally().top('12px');
      this.overlayRef = this.overlay.create({
        positionStrategy: this.position,
        scrollStrategy: this.overlay.scrollStrategies.block(),
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
      });
      this.subscriptions.add(this.overlayRef.backdropClick().subscribe(() => this.close()));
      this.subscriptions.add(this.overlayRef.keydownEvents().subscribe(event => this.onOverlayKeydown(event)));
    }
    if (!this.overlayRef.hasAttached()) {
      this.positionPanel();
      this.overlayRef.attach(new TemplatePortal(this.panelTemplate, this.viewContainer));
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.overlayRef?.hasAttached()) this.positionPanel();
  }

  private positionPanel(): void {
    if (!this.overlayRef || !this.position) return;
    const belowButton = this.origin.elementRef.nativeElement.getBoundingClientRect().bottom + 8;
    // Keep a stable top edge across tab/content changes. On mobile, or when
    // the trigger is too low, use the viewport's top margin instead.
    const top = window.innerWidth > 575 && window.innerHeight - belowButton - 12 >= 200
      ? Math.max(12, belowButton) : 12;
    const maxHeight = `calc(100dvh - ${top + 12}px)`;
    this.position.top(`${top}px`);
    this.overlayRef.updateSize({maxHeight});
    this.overlayRef.overlayElement.style.setProperty('--settings-panel-max-height', maxHeight);
    if (this.overlayRef.hasAttached()) this.overlayRef.updatePosition();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.overlayRef?.dispose();
  }

  close(): void { this.openChange.emit(false); }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % this.tabs.length; break;
      case 'ArrowLeft': next = (index + this.tabs.length - 1) % this.tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = this.tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    this.activeTabChange.emit(this.tabs[next].id);
    document.getElementById(`${this.panelId}-tab-${this.tabs[next].id}`)?.focus();
  }
}
