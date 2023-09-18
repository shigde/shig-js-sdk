import {Injector, NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {LobbyComponent} from './lobby/lobby.component';
import {createCustomElement} from '@angular/elements';

@NgModule({
  declarations: [
    LobbyComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
})
export class AppModule {
  constructor(private injector: Injector) {
  }

  ngDoBootstrap() {
    const customElement = createCustomElement(LobbyComponent, {injector: this.injector});
    customElements.define('shig-lobby', customElement);
  }
}
