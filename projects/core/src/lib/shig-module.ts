import {CUSTOM_ELEMENTS_SCHEMA, NgModule, NO_ERRORS_SCHEMA} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
    AudioMeterComponent,
    DeviceCaptureComponent,
    GuestListDirective,
    GuestListComponent,
    GuestComponent,
    LobbyComponent, StreamFriendsComponent, StreamLayoutEditorComponent, LoadingIndicatorComponent,
} from './component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {Combobox, ComboboxInput, ComboboxPopupContainer} from "@angular/aria/combobox";
import {Listbox, Option} from "@angular/aria/listbox";
import {OverlayModule} from "@angular/cdk/overlay";
import {SettingsPanelComponent} from './component/settings-panel/settings-panel.component';
import {StreamSettingsComponent} from './component/stream-settings/stream-settings.component';
import {StreamOverlayMenuComponent} from './component/stream-overlay-menu/stream-overlay-menu.component';

// import '@material/web/common';


@NgModule({
  declarations: [
    AudioMeterComponent,
    DeviceCaptureComponent,
    LobbyComponent,
    GuestListDirective,
    GuestListComponent,
    GuestComponent,
    StreamFriendsComponent,
    StreamSettingsComponent
  ],
  exports: [
    AudioMeterComponent,
    DeviceCaptureComponent,
    LobbyComponent,
    SettingsPanelComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    imports: [
        Combobox,
        ComboboxInput,
        ComboboxPopupContainer,
        Listbox,
        Option,
        OverlayModule,
        SettingsPanelComponent,
        StreamOverlayMenuComponent,
        CommonModule,
        LoadingIndicatorComponent,
        FormsModule,
        ReactiveFormsModule,
        StreamLayoutEditorComponent
    ],
  providers: [provideHttpClient(withInterceptorsFromDi())]
})
export class ShigModule {
}
