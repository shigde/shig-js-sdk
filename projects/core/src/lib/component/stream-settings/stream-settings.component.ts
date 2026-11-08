import {Component, Input, TemplateRef} from '@angular/core';
import {StreamLayoutEditorComponent} from '../stream-layout-editor/stream-layout-editor.component';
import {SettingsTab} from '../settings-panel/settings-panel.component';

@Component({
  selector: 'shig-stream-settings',
  standalone: false,
  templateUrl: './stream-settings.component.html',
  styleUrl: './stream-settings.component.scss',
})
export class StreamSettingsComponent {
  @Input() centered = false;
  @Input() devicesEnabled = false;
  @Input() editorProvider?: () => StreamLayoutEditorComponent | undefined;
  get editor(): StreamLayoutEditorComponent | undefined {
    return this.editorProvider?.();
  }
  @Input() streamUuid?: string;
  @Input() userUuid?: string;
  @Input() videosTemplate?: TemplateRef<unknown>;
  open = false;
  activeTab = 'layout';
  newReplay = false;
  get tabs(): SettingsTab[] { return [
    {id: 'layout', label: 'Layout', icon: 'bi-grid'},
    {id: 'overlay', label: 'Overlay', icon: 'bi-layers'},
    {id: 'guests', label: 'Guests', icon: 'bi-person-plus'},
    ...(this.devicesEnabled && this.streamUuid ? [{id: 'devices', label: 'Devices', icon: 'bi-camera-video'}] : []),
    ...(this.videosTemplate ? [{
      id: 'videos', label: 'Replays', icon: 'bi-collection-play',
      notificationLabel: this.newReplay ? 'New replay' : undefined,
    }] : []),
  ]; }

  openVideos(): void {
    this.selectTab('videos');
    this.setOpen(true);
  }

  notifyReplayReady(): void {
    this.newReplay = true;
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (!open) this.newReplay = false;
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'videos') this.newReplay = false;
  }
}
