import {CUSTOM_ELEMENTS_SCHEMA, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';
import {DeviceSettingsComponent, LobbyComponent, NewLobbyComponent, SvgSettingsComponent} from './component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import '@material/web/switch/switch';
import '@material/web/chips/filter-chip';


@NgModule({
    declarations: [
        DeviceSettingsComponent,
        LobbyComponent,
        NewLobbyComponent,
        SvgSettingsComponent
    ],
    imports: [
        CommonModule,
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule
    ],
    exports: [
        DeviceSettingsComponent,
        LobbyComponent,
        SvgSettingsComponent
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ShigModule {
}
