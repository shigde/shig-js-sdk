import {Injector, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {createCustomElement} from '@angular/elements';
import {httpInterceptorProviders, ShigModule, LobbyComponent, NewLobbyComponent} from 'core';
import {HttpClientModule} from '@angular/common/http';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({
    declarations: [
    ],
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule,
        ShigModule
    ],
    providers: [
        httpInterceptorProviders,
    ],
    bootstrap:[NewLobbyComponent]
})
export class AppModule {
    constructor(private injector: Injector) {
    }

    ngDoBootstrap() {
        const customElement = createCustomElement(LobbyComponent, {injector: this.injector});
        customElements.define('shig-lobby', customElement);
    }
}
