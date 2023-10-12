import {Injector, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {LobbyComponent} from './lobby/lobby.component';
import {createCustomElement} from '@angular/elements';
import {httpInterceptorProviders} from 'core';
import {HttpClientModule} from '@angular/common/http';

@NgModule({
  declarations: [
    LobbyComponent
  ],
  imports: [
    BrowserModule,
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
