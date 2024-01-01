import {Directive, ViewContainerRef} from '@angular/core';

@Directive({
    selector: '[shigGuestList]'
})
export class GuestListDirective {
    constructor(public viewContainerRef: ViewContainerRef) {
    }
}
