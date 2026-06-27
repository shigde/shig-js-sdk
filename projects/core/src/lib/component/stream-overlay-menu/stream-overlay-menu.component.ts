import {Component, OnInit} from '@angular/core';
import {NameplateOverlaySize, StreamOverlayService} from '../../provider/stream-overlay.service';

@Component({
  selector: 'shig-stream-overlay-menu',
  imports: [],
  templateUrl: './stream-overlay-menu.component.html',
  styleUrl: './stream-overlay-menu.component.scss',
})
export class StreamOverlayMenuComponent implements OnInit {
  nameOverlayEnabled = false;
  nameOverlaySize: NameplateOverlaySize = 'B';

  constructor(
    private overlays: StreamOverlayService,
  ) {
  }

  ngOnInit(): void {
    this.nameOverlayEnabled = this.overlays.isNameplateEnabled();
    this.nameOverlaySize = this.overlays.getNameplateSize();
  }

  toggleNameOverlay(): void {
    this.nameOverlayEnabled = !this.nameOverlayEnabled;
    this.overlays.setNameplateEnabled(this.nameOverlayEnabled);
  }

  setNameOverlaySize(size: NameplateOverlaySize): void {
    this.nameOverlaySize = size;
    this.overlays.setNameplateSize(size);
  }
}
