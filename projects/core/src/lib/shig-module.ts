import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';
import {DeviceSettingsComponent, LobbyComponent, SvgSettingsComponent} from './component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

@NgModule({
    declarations: [
        DeviceSettingsComponent,
        LobbyComponent,
        SvgSettingsComponent
    ],
    imports: [
        CommonModule,
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule,
    ],
    exports: [
        DeviceSettingsComponent,
        LobbyComponent,
        SvgSettingsComponent
    ]
})
export class ShigModule {
}
