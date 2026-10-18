import {CommonModule} from '@angular/common';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {OverlayContainer, OverlayModule} from '@angular/cdk/overlay';
import {SettingsPanelComponent} from '../settings-panel/settings-panel.component';
import {StreamSettingsComponent} from './stream-settings.component';
import {StreamLayoutEditorComponent} from '../stream-layout-editor/stream-layout-editor.component';

describe('Host stream settings', () => {
  it('keeps layout controls wired and places Guests last', async () => {
    TestBed.configureTestingModule({
      declarations: [StreamSettingsComponent],
      imports: [CommonModule, OverlayModule, SettingsPanelComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    const fixture = TestBed.createComponent(StreamSettingsComponent);
    const editor = {
      ready: true, layoutEditMode: false,
      toggleLayoutEditMode: jasmine.createSpy('toggleLayoutEditMode'),
      resetTileLayout: jasmine.createSpy('resetTileLayout'),
    };
    fixture.componentInstance.editorProvider = () => editor as unknown as StreamLayoutEditorComponent;
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map(tab => tab.textContent?.trim())).toEqual(['Layout', 'Overlay', 'Guests']);
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    expect(editor.toggleLayoutEditMode).toHaveBeenCalled();
    container.querySelector<HTMLButtonElement>('.stream-layout-settings .btn')!.click();
    expect(editor.resetTileLayout).toHaveBeenCalled();
    tabs[1].click();
    fixture.detectChanges();
    expect(container.querySelector('shig-stream-overlay-menu')).not.toBeNull();
    tabs[2].click();
    fixture.detectChanges();
    expect(container.querySelector('app-stream-friends')).not.toBeNull();
    container.querySelector<HTMLButtonElement>('.settings-panel-close')!.click();
    fixture.detectChanges();
    expect(container.querySelector('.settings-panel')).toBeNull();
    fixture.destroy();
  });
});
