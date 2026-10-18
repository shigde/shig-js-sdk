# Settings Panel

Host stream settings reuse this panel with Layout, Overlay and Guests tabs, in that order. Device selection remains separate. The mixer owns its bottom-right fullscreen control.

`SettingsPanelComponent` is the shared, light Shig settings popover. It is exported from `@shigde/core` and through `ShigModule`. Reuse this shell instead of building another settings header, tab strip or popup container.

Import `OverlayModule` for the trigger's `cdkOverlayOrigin` directive. Provide that `CdkOverlayOrigin`, bind `open`, and optionally provide a heading, subtitle and tabs. Bind `activeTab` to select the projected settings content. Icons use the application's existing Bootstrap Icons classes.

```html
<button cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="open = !open"
        aria-label="Settings" [attr.aria-expanded]="open">...</button>
<shig-settings-panel [origin]="origin" [(open)]="open"
                     [tabs]="tabs" [(activeTab)]="activeTab">
  @if (open && activeTab === 'audio') {
    <!-- Existing audio controls -->
  }
</shig-settings-panel>
```

For example, `tabs = [{id: 'audio', label: 'Audio', icon: 'bi-volume-up'}]` with `activeTab = 'audio'`. Gate resource-owning content with `open` so closing the panel also destroys meters and their audio resources.

The CDK overlay escapes tile overflow, stays within the viewport and closes through the close button, Escape or an outside click. Focus is captured while open and restored on closure. No global alert or modal service is involved. Colors inherit the application's Bootstrap/Shig variables; the shell does not define a separate dark theme.
