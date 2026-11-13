import {Component, OnInit} from '@angular/core';
import {NameplateOverlaySize, ScoreboardState, StreamOverlayService} from '../../provider/stream-overlay.service';

@Component({
  selector: 'shig-stream-overlay-menu',
  imports: [],
  templateUrl: './stream-overlay-menu.component.html',
  styleUrl: './stream-overlay-menu.component.scss',
})
export class StreamOverlayMenuComponent implements OnInit {
  nameOverlayEnabled = false;
  nameOverlaySize: NameplateOverlaySize = 'B';
  scoreboard: ScoreboardState;

  constructor(
    private overlays: StreamOverlayService,
  ) {
    this.scoreboard = this.overlays.getScoreboardState();
  }

  ngOnInit(): void {
    this.nameOverlayEnabled = this.overlays.isNameplateEnabled();
    this.nameOverlaySize = this.overlays.getNameplateSize();
    this.refreshScoreboard();
  }

  toggleNameOverlay(): void {
    this.nameOverlayEnabled = !this.nameOverlayEnabled;
    this.overlays.setNameplateEnabled(this.nameOverlayEnabled);
  }

  setNameOverlaySize(size: NameplateOverlaySize): void {
    this.nameOverlaySize = size;
    this.overlays.setNameplateSize(size);
  }

  refreshScoreboard(): void {
    this.scoreboard = this.overlays.getScoreboardState();
  }

  updateScoreboard(patch: Partial<ScoreboardState>): void {
    this.overlays.updateScoreboard(patch);
    this.refreshScoreboard();
  }

  resetTimer(): void {
    this.overlays.resetScoreboardTimer();
    this.refreshScoreboard();
  }

  onTextChange(field: 'homeName' | 'awayName' | 'homeAbbr' | 'awayAbbr', event: Event): void {
    this.updateScoreboard({[field]: (event.target as HTMLInputElement).value});
  }

  onColorChange(field: 'homeColor' | 'awayColor', event: Event): void {
    this.updateScoreboard({[field]: (event.target as HTMLInputElement).value});
  }

  onDurationChange(event: Event): void {
    const minutes = Number((event.target as HTMLInputElement).value) || 0;
    this.updateScoreboard({timerDuration: Math.max(0, minutes) * 60});
  }

}
