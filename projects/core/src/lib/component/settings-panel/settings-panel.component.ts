import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CdkOverlayOrigin, ConnectedPosition, OverlayModule} from '@angular/cdk/overlay';
import {A11yModule} from '@angular/cdk/a11y';

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
export class SettingsPanelComponent {
  @Input({required: true}) origin!: CdkOverlayOrigin;
  @Input() open = false;
  @Input() heading = 'Settings';
  @Input() subtitle = '';
  @Input() tabs: SettingsTab[] = [];
  @Input() activeTab = '';
  @Output() openChange = new EventEmitter<boolean>();
  @Output() activeTabChange = new EventEmitter<string>();

  readonly panelId = `shig-settings-${nextPanelId++}`;
  readonly positions: ConnectedPosition[] = [
    {originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetX: -8},
    {originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8},
    {originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8},
  ];

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
