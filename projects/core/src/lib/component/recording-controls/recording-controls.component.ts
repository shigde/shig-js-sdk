import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, TemplateRef, ViewChild} from '@angular/core';
import {DatePipe, NgTemplateOutlet} from '@angular/common';
import {Subscription, finalize} from 'rxjs';
import {MediaService} from '../../provider/media.service';
import {MediaRecording} from '../../entities/media-recording';
import {RecordedVideo} from '../../entities/recorded-video';
import {VideoService} from '../../provider/video.service';

/** Start/stop controls and the lobby's replay list; publication stays outside the lobby. */
@Component({
  selector: 'shig-recording-controls',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet],
  host: {'[class.embedded]': 'embedded'},
  template: `
    @if (!embedded) { <ng-container [ngTemplateOutlet]="panel"></ng-container> }
    <ng-template #panel>
    <section class="recording-controls settings-section" [class.in-settings]="embedded" aria-label="Replays">
      <h3 class="settings-heading">Replays</h3>
      @if (error) { <p class="recording-error" role="alert">{{ error }}</p> }
      @if (listError) {
        <p class="recording-error" role="alert">{{ listError }}</p>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="refreshReplays()">Try again</button>
      }
      @if (!replaysLoaded && !listError) {
        <p role="status">Loading replays…</p>
      } @else if (replaysLoaded) {
        <ol class="replay-list">
          @for (item of replays; track item.uuid; let index = $index) {
            <li class="replay-item settings-box">
              <div class="replay-heading">
                <h4>Replay {{ index + 1 }}</h4>
                <span class="replay-status" [class.recording-error]="item.status === 'failed'" role="status">
                  <i [class]="'bi ' + statusInfo(item.status).icon" aria-hidden="true"></i>
                  {{ statusInfo(item.status).label }}
                </span>
              </div>
              <p class="replay-title">{{ item.title }}</p>
              <dl class="replay-metadata">
                <div><dt>Created</dt><dd>{{ recordedAt(item) | date:'dd.MM.yyyy · HH:mm' }}</dd></div>
                @if (item.durationMs > 0) {
                  <div><dt>Duration</dt><dd>{{ duration(item.durationMs) }}</dd></div>
                }
              </dl>
              @if (item.status === 'failed') {
                <p class="recording-hint">This recording could not be completed.</p>
              }
              @if (item.error) {
                <details class="recording-hint">
                  <summary>Technical details</summary>
                  <pre>{{ item.error }}</pre>
                </details>
              }
              <div class="replay-actions">
                @if (item.status === 'ready') {
                  <button type="button" class="btn btn-link btn-sm p-0" (click)="replayOpen.emit(item.uuid)"
                          [disabled]="deletingUuid !== ''">
                    <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> Open replay
                  </button>
                }
                <button type="button" class="btn btn-outline-secondary btn-sm replay-delete"
                        [disabled]="deletingUuid !== '' || item.status === 'recording' || item.status === 'processing'"
                        (click)="pendingDeleteUuid = item.uuid; deleteError = ''"
                        [attr.aria-label]="'Permanently delete Replay ' + (index + 1)" title="Delete permanently">
                  <i class="bi bi-trash" aria-hidden="true"></i>
                </button>
              </div>
              @if (pendingDeleteUuid === item.uuid) {
                <div class="replay-delete-confirm" role="group" aria-label="Confirm permanent deletion">
                  <p>Permanently delete Replay {{ index + 1 }} and all its video files? This cannot be undone.</p>
                  @if (deleteError) { <p class="recording-error" role="alert">{{ deleteError }}</p> }
                  <div class="replay-confirm-actions">
                    <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="deletingUuid !== ''"
                            (click)="pendingDeleteUuid = ''; deleteError = ''">Cancel</button>
                    <button type="button" class="btn btn-danger btn-sm" [disabled]="deletingUuid !== ''" (click)="deleteReplay(item)">
                      {{ deletingUuid === item.uuid ? 'Deleting…' : 'Delete permanently' }}
                    </button>
                  </div>
                </div>
              }
            </li>
          } @empty {
            <li class="recording-hint">No replays yet. Use Record during the live stream.</li>
          }
        </ol>
      }
    </section>
    </ng-template>
  `,
  styleUrl: './recording-controls.component.scss',
  styles: [`
    :host { display:block; }
    :host.embedded { display:none; }
    .recording-controls { padding:1rem; border:1px solid var(--bs-border-color,#555); border-radius:.5rem; }
    .recording-controls.in-settings { padding:0; border:0; }
    h3 { font-size:1.1rem; margin:0 0 .7rem; }
    .replay-list { display:grid; gap:12px; list-style:none; margin:0; padding:0; }
    .replay-heading { display:flex; align-items:center; justify-content:space-between; gap:.75rem; flex-wrap:wrap; }
    h4 { margin:0; font-size:1rem; }
    .replay-status { display:inline-flex; align-items:center; gap:.4rem; font-size:.9rem; }
    .replay-title { margin:.4rem 0; overflow-wrap:anywhere; }
    .replay-metadata { display:flex; gap:.5rem 1.5rem; flex-wrap:wrap; margin:0; font-size:.85rem; opacity:.75; }
    .replay-metadata div { display:flex; gap:.4rem; }
    dt { font-weight:400; } dd { margin:0; }
    summary { cursor:pointer; }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; max-height:160px; overflow:auto; margin:.5rem 0 0; font-size:inherit; }
    .recording-hint { margin:.5rem 0 0; font-size:.9rem; opacity:.75; }
    .recording-error,.recording-dot { color:var(--bs-danger,#dc3545); }
    .replay-actions { display:flex; align-items:center; gap:12px; margin-top:12px; }
    .replay-delete { margin-left:auto; }
    .replay-delete-confirm { margin-top:12px; padding-top:12px; border-top:1px solid var(--bs-border-color,#ddd); font-size:.9rem; }
    .replay-confirm-actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px; }
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
  @Output() replayOpen = new EventEmitter<string>();
  recording?: MediaRecording;
  replays: RecordedVideo[] = [];
  replaysLoaded = false;
  listError = '';
  busy = false;
  error = '';
  pendingDeleteUuid = '';
  deletingUuid = '';
  deleteError = '';
  private watchedStream = '';
  private awaitingStoppedRecording = false;
  private subscriptions = new Subscription();
  private listRequest?: Subscription;
  constructor(private media: MediaService, private cdr: ChangeDetectorRef, private videos: VideoService) {}

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
    this.replays = [];
    this.replaysLoaded = false;
    this.listError = '';
    this.error = '';
    this.pendingDeleteUuid = '';
    this.deleteError = '';
    this.subscriptions.add(this.media.getRecording(this.streamUuid).subscribe({
      next: value => this.update(value), error: error => this.fail(error),
    }));
  }
  toggleRecording(): void {
    if (this.busy || !this.recording || !this.live) return;
    if (this.recording.status === 'recording' && !this.recording.videoUuid) return;
    this.busy = true; this.error = '';
    this.awaitingStoppedRecording = this.recording.status === 'recording';
    const operation = this.awaitingStoppedRecording
      ? this.media.stopRecording(this.recording.videoUuid!) : this.media.startRecording(this.streamUuid);
    this.subscriptions.add(operation.pipe(finalize(() => { this.busy = false; this.cdr.markForCheck(); })).subscribe({
      next: value => this.update(value), error: error => {
        this.awaitingStoppedRecording = false;
        this.fail(error);
        this.actionFailed.emit();
      },
    }));
  }
  refreshReplays(): void {
    this.listRequest?.unsubscribe();
    this.listError = '';
    this.listRequest = this.videos.listForStream(this.streamUuid).subscribe({
      next: videos => {
        // The API returns newest first. Number the lobby's recordings oldest first.
        this.replays = [...videos].reverse();
        this.replaysLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.listError = 'Could not load replays. Please try again.';
        this.cdr.markForCheck();
      },
    });
    this.subscriptions.add(this.listRequest);
  }
  deleteReplay(video: RecordedVideo): void {
    if (this.deletingUuid || this.pendingDeleteUuid !== video.uuid ||
        ['recording', 'processing'].includes(video.status)) return;
    this.deletingUuid = video.uuid;
    this.deleteError = '';
    this.subscriptions.add(this.videos.delete(video.uuid).pipe(
      finalize(() => { this.deletingUuid = ''; this.cdr.markForCheck(); }),
    ).subscribe({
      next: () => {
        this.replays = this.replays.filter(item => item.uuid !== video.uuid);
        this.pendingDeleteUuid = '';
        this.subscriptions.add(this.media.getRecording(this.streamUuid).subscribe({
          next: value => this.update(value), error: error => this.fail(error),
        }));
        this.cdr.markForCheck();
      },
      error: () => {
        this.deleteError = 'Deletion could not be completed. Please retry.';
        this.refreshReplays();
        this.cdr.markForCheck();
      },
    }));
  }
  statusInfo(status: RecordedVideo['status']): {label: string; icon: string} {
    return {
      pending: {label: 'Waiting to record', icon: 'bi-clock'},
      recording: {label: 'Recording', icon: 'bi-record-circle'},
      processing: {label: 'Processing', icon: 'bi-hourglass-split'},
      ready: {label: 'Ready', icon: 'bi-check-circle'},
      failed: {label: 'Recording failed', icon: 'bi-exclamation-triangle'},
      deleting: {label: 'Deletion pending', icon: 'bi-trash'},
    }[status];
  }
  recordedAt(video: RecordedVideo): string {
    const date = video.startedAt || video.createdAt;
    return /(?:Z|[+-]\d{2}:\d{2})$/.test(date) ? date : `${date}Z`;
  }
  duration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  private update(value: MediaRecording): void {
    this.refreshReplays();
    this.recording = value; this.error = ''; this.recordingChange.emit(value); this.cdr.markForCheck();
    if (this.awaitingStoppedRecording && (value.status === 'ready' || value.status === 'failed' || value.status === 'empty')) {
      this.awaitingStoppedRecording = false;
      if (value.status === 'ready') this.recordingStopped.emit();
      if (value.status === 'failed') this.actionFailed.emit();
    }
  }
  private fail(error: {error?: {message?: string}}): void {
    this.refreshReplays();
    this.error = error.error?.message || 'Could not update recording. Please try again.';
    this.cdr.markForCheck();
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}
