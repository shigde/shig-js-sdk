import {Injector, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {LobbyComponent} from './lobby/lobby.component';
import {createCustomElement} from '@angular/elements';
import {httpInterceptorProviders} from 'core';
import {HttpClientModule} from '@angular/common/http';
import {DeviceSettingsComponent} from './device-settings/device-settings.component';
import {SvgSettingsComponent} from './svg/settings.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({
    declarations: [
        DeviceSettingsComponent,
        LobbyComponent,
        SvgSettingsComponent
    ],
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule,
    ],
    providers: [
        httpInterceptorProviders,
    ],
})
export class AppModule {
    constructor(private injector: Injector) {
    }

    ngDoBootstrap() {
        const customElement = createCustomElement(LobbyComponent, {injector: this.injector});
        customElements.define('shig-lobby', customElement);
    }
}
