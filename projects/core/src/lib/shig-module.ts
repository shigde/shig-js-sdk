import {LobbyNextComponent} from './component';
import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';

@NgModule({
    declarations: [
       LobbyNextComponent,
    ],
    imports: [
        BrowserModule,
        CommonModule
    ],
    exports: [
        LobbyNextComponent
    ]
})
export class ShigModule { }
