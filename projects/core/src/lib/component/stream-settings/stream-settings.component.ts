import {Component, Input} from '@angular/core';
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
  open = false;
  activeTab = 'layout';
  readonly tabs: SettingsTab[] = [
    {id: 'layout', label: 'Layout', icon: 'bi-grid'},
    {id: 'overlay', label: 'Overlay', icon: 'bi-layers'},
    {id: 'guests', label: 'Guests', icon: 'bi-person-plus'},
  ];
}
