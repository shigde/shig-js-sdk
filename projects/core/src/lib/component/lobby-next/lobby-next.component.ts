import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'lib-lobby-next',
  templateUrl: './lobby-next.component.html',
  styleUrls: ['./lobby-next.component.css']
})
export class LobbyNextComponent {
    @Input() token: string | undefined;
    @Input('api-prefix') apiPrefix: string | undefined;
    @Input('stream') streamId: string | undefined;
    @Input('space') spaceId: string | undefined;
    @Input('user') user: string | undefined;

    @Input() role: string | null = 'guest';

    @Output() loadComp = new EventEmitter();

}
