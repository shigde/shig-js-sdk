import {Injector, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {createCustomElement} from '@angular/elements';
import {httpInterceptorProviders, ShigModule, LobbyComponent} from 'core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({ declarations: [], imports: [BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        ShigModule], providers: [
        httpInterceptorProviders,
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {
    constructor(private injector: Injector) {
    }

    ngDoBootstrap() {
        const customElement = createCustomElement(LobbyComponent, {injector: this.injector});
        customElements.define('shig-lobby', customElement);
    }
}
