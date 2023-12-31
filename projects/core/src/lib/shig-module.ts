import {CUSTOM_ELEMENTS_SCHEMA, NgModule, NO_ERRORS_SCHEMA} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';
import {
    DeviceSettingsComponent,
    GuestListDirective,
    GuestListComponent,
    GuestComponent,
    LobbyComponent,
} from './component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import '@material/web/switch/switch';
import '@material/web/chips/filter-chip';


@NgModule({
    declarations: [
        DeviceSettingsComponent,
        LobbyComponent,
        GuestListDirective,
        GuestListComponent,
        GuestComponent
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
        LobbyComponent
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class ShigModule {
}
