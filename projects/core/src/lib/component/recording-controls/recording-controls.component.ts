import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, TemplateRef, ViewChild} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {Subscription, finalize} from 'rxjs';
import {MediaService} from '../../provider/media.service';
import {MediaRecording} from '../../entities/media-recording';

/** Shared by the host lobby and persistent stream settings. */
@Component({
  selector: 'shig-recording-controls',
  standalone: true,
  imports: [NgTemplateOutlet],
  host: {'[class.embedded]': 'embedded'},
  template: `
    @if (!embedded) { <ng-container [ngTemplateOutlet]="panel"></ng-container> }
    <ng-template #panel>
    <section class="recording-controls" [class.in-settings]="embedded" aria-label="Videos">
      <h3>{{ embedded ? 'Videos' : 'Recording' }}</h3>
      @if (error) { <p class="recording-error" role="alert">{{ error }}</p> }
      @if (recording; as item) {
        <p role="status" aria-live="polite">
          @switch (item.status) {
            @case ('empty') { No video recorded yet. Use Record during the live stream. }
            @case ('recording') { <span class="recording-dot">●</span> Recording in progress }
            @case ('finalizing') { Finishing recording… }
            @case ('ready') { Video ready · {{ duration(item.durationMs) }} }
            @case ('failed') { Recording failed. {{ item.error }} }
          }
        </p>
        @if (item.status === 'ready') {
        <label class="recording-publication">
          <input type="checkbox" role="switch" [checked]="item.published"
                 [disabled]="busy || (!item.published && (live || item.status !== 'ready'))"
                 (change)="publish($event)">
          Publish video
        </label>
        <p class="recording-hint">{{ item.published ? 'Visible to this stream’s viewers. You can unpublish it at any time.' : 'Private. Closing settings keeps this video private. You can publish it here after the live stream has ended.' }}</p>
        }
      } @else if (!error) { <p role="status">Loading recording…</p> }
    </section>
    </ng-template>
  `,
  styles: [`
    :host { display:block; }
    :host.embedded { display:none; }
    .recording-controls { padding:1rem; border:1px solid var(--bs-border-color,#555); border-radius:.5rem; }
    .recording-controls.in-settings { padding:0; border:0; }
    h3 { font-size:1.1rem; margin:0 0 .7rem; }
    .recording-publication { display:flex; gap:.6rem; align-items:center; }
    .recording-hint { margin:.5rem 0 0; font-size:.9rem; opacity:.75; }
    .recording-error,.recording-dot { color:var(--bs-danger,#dc3545); }
  `],
})
export class RecordingControlsComponent implements OnChanges, OnDestroy {
  @Input({required: true}) streamUuid = '';
  @Input() live = false;
  @Input() embedded = false;
  @ViewChild('panel', {static: true}) panel!: TemplateRef<unknown>;
  @Output() recordingChange = new EventEmitter<MediaRecording>();
  @Output() recordingStopped = new EventEmitter<void>();
  @Output() actionFailed = new EventEmitter<void>();
  recording?: MediaRecording;
  busy = false;
  error = '';
  private watchedStream = '';
  private awaitingStoppedRecording = false;
  private subscriptions = new Subscription();
  constructor(private media: MediaService, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    if (!this.streamUuid) return;
    if (this.watchedStream === this.streamUuid) {
      // Refresh immediately when live ends, including embedded SDK lobbies
      // whose token is set before their principal polling state is initialized.
      this.subscriptions.add(this.media.getRecording(this.streamUuid).subscribe({
        next: value => this.update(value), error: error => this.fail(error),
      }));
      return;
    }
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.watchedStream = this.streamUuid;
    this.awaitingStoppedRecording = false;
    this.recording = undefined;
    this.error = '';
    this.subscriptions.add(this.media.getRecording(this.streamUuid).subscribe({
      next: value => this.update(value), error: error => this.fail(error),
    }));
  }
  toggleRecording(): void {
    if (this.busy || !this.recording || !this.live) return;
    this.busy = true; this.error = '';
    this.awaitingStoppedRecording = this.recording.status === 'recording';
    const operation = this.awaitingStoppedRecording
      ? this.media.stopRecording(this.streamUuid) : this.media.startRecording(this.streamUuid);
    this.subscriptions.add(operation.pipe(finalize(() => { this.busy = false; this.cdr.markForCheck(); })).subscribe({
      next: value => this.update(value), error: error => {
        this.awaitingStoppedRecording = false;
        this.fail(error);
        this.actionFailed.emit();
      },
    }));
  }
  publish(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.checked;
    input.checked = this.recording?.published ?? false;
    if (this.busy) return;
    this.busy = true; this.error = '';
    this.subscriptions.add(this.media.setPublished(this.streamUuid, value).pipe(
      finalize(() => { this.busy = false; this.cdr.markForCheck(); }),
    ).subscribe({next: value => this.update(value), error: error => this.fail(error)}));
  }
  duration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  private update(value: MediaRecording): void {
    this.recording = value; this.error = ''; this.recordingChange.emit(value); this.cdr.markForCheck();
    if (this.awaitingStoppedRecording && (value.status === 'ready' || value.status === 'failed' || value.status === 'empty')) {
      this.awaitingStoppedRecording = false;
      if (value.status === 'ready') this.recordingStopped.emit();
      if (value.status === 'failed') this.actionFailed.emit();
    }
  }
  private fail(error: {error?: {message?: string}}): void {
    this.error = error.error?.message || 'Could not update recording. Please try again.';
    this.cdr.markForCheck();
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}
