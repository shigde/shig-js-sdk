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
  @Input() editorProvider?: () => StreamLayoutEditorComponent | undefined;
  get editor(): StreamLayoutEditorComponent | undefined {
    return this.editorProvider?.();
  }
  @Input() streamUuid?: string;
  @Input() userUuid?: string;
  @Input() videosTemplate?: TemplateRef<unknown>;
  open = false;
  activeTab = 'layout';
  get tabs(): SettingsTab[] { return [
    {id: 'layout', label: 'Layout', icon: 'bi-grid'},
    {id: 'overlay', label: 'Overlay', icon: 'bi-layers'},
    {id: 'guests', label: 'Guests', icon: 'bi-person-plus'},
    ...(this.videosTemplate ? [{id: 'videos', label: 'Replays', icon: 'bi-collection-play'}] : []),
  ]; }

  openVideos(): void {
    this.activeTab = 'videos';
    this.open = true;
  }
}
