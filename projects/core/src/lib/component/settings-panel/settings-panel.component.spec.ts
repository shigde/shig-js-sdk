import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {OverlayContainer, OverlayModule} from '@angular/cdk/overlay';
import {SettingsPanelComponent} from './settings-panel.component';

@Component({
  standalone: true,
  imports: [OverlayModule, SettingsPanelComponent],
  template: `
    <button cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="open = !open">Settings</button>
    <shig-settings-panel [origin]="origin" [(open)]="open" [tabs]="tabs" [(activeTab)]="activeTab">
      <label>Volume <input type="range" aria-label="Volume"></label>
      @if (longContent) {
        @for (row of rows; track row) { <p style="min-height:40px">Replay {{ row }}</p> }
      }
    </shig-settings-panel>`,
})
class PanelHost {
  longContent = false;
  rows = Array.from({length: 60}, (_, index) => index + 1);
  open = false;
  activeTab = 'audio';
  tabs = [{id: 'audio', label: 'Audio', icon: 'bi-volume-up'}, {id: 'video', label: 'Video', icon: 'bi-camera-video'}];
}

describe('SettingsPanelComponent', () => {
  it('keeps the header in the viewport and scrolls only content as the panel grows', async () => {
    const fixture = TestBed.createComponent(PanelHost);
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await fixture.whenStable();
    const initialPanel = TestBed.inject(OverlayContainer).getContainerElement().querySelector<HTMLElement>('.settings-panel')!;
    const initialTop = initialPanel.getBoundingClientRect().top;
    fixture.componentInstance.longContent = true;
    fixture.detectChanges();
    await fixture.whenStable();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const panel = container.querySelector<HTMLElement>('.settings-panel')!;
    const content = panel.querySelector<HTMLElement>('.settings-panel-content')!;
    const close = panel.querySelector<HTMLElement>('.settings-panel-close')!;
    expect(panel.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(panel.getBoundingClientRect().top).toBe(initialTop);
    expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    const headerTop = close.getBoundingClientRect().top;
    content.scrollTop = content.scrollHeight;
    expect(close.getBoundingClientRect().top).toBe(headerTop);
    content.scrollTop = 0;
    expect(content.scrollTop).toBe(0);
    fixture.destroy();
  });
  for (const dark of [false, true]) {
    it(`keeps a single tab compact and transparent in ${dark ? 'dark' : 'light'} mode`, async () => {
      const fixture = TestBed.createComponent(PanelHost);
      fixture.componentInstance.tabs = [{id: 'audio', label: 'Audio', icon: 'bi-volume-up'}];
      fixture.componentInstance.open = true;
      const container = TestBed.inject(OverlayContainer).getContainerElement();
      container.style.setProperty('--bs-body-bg', dark ? '#212529' : '#ffffff');
      container.style.setProperty('--bs-body-color', dark ? '#dee2e6' : '#343a40');
      fixture.detectChanges();
      await fixture.whenStable();
      const tab = container.querySelector<HTMLElement>('[role="tab"]')!;
      const style = getComputedStyle(tab);
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(style.color).toBe(dark ? 'rgb(222, 226, 230)' : 'rgb(52, 58, 64)');
      expect(style.borderBottomWidth).toBe('2px');
      expect(style.borderBottomStyle).toBe('solid');
      expect(tab.getBoundingClientRect().height).toBeLessThanOrEqual(44);
      expect(tab.getBoundingClientRect().width).toBeLessThan(160);
      fixture.destroy();
    });
  }
  it('opens outside its origin, fits the viewport, and closes with its close button', async () => {
    const fixture = TestBed.createComponent(PanelHost);
    fixture.detectChanges();
    const origin = fixture.nativeElement.querySelector('button');
    origin.style.cssText = 'position:fixed;right:12px;bottom:12px';
    origin.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const panel = container.querySelector<HTMLElement>('.settings-panel')!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('dialog');
    const rect = panel.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(getComputedStyle(panel).backgroundColor).toBe('rgb(255, 255, 255)');
    panel.querySelector<HTMLButtonElement>('.settings-panel-close')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open).toBeFalse();
    expect(container.querySelector('.settings-panel')).toBeNull();
    fixture.destroy();
  });

  it('supports keyboard tabs, Escape and outside-click dismissal', async () => {
    const fixture = TestBed.createComponent(PanelHost);
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    await fixture.whenStable();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    const first = container.querySelector<HTMLButtonElement>('[role="tab"]')!;
    first.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab).toBe('video');
    expect(container.querySelectorAll('[aria-selected="true"]').length).toBe(1);
    document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(fixture.componentInstance.open).toBeFalse();
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    container.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open).toBeFalse();
    fixture.destroy();
  });
});
