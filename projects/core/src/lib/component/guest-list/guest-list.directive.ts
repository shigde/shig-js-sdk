import {Directive, ViewContainerRef} from '@angular/core';

@Directive({
    selector: '[shigGuestList]',
    standalone: false
})
export class GuestListDirective {
    constructor(public viewContainerRef: ViewContainerRef) {
    }
}
