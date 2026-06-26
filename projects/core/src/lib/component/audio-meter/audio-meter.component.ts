import {
  Component,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy,
  QueryList,
  ViewChildren,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {createLogger} from '../../provider';

@Component({
  selector: 'app-audio-meter',
  templateUrl: './audio-meter.component.html',
  styleUrls: ['./audio-meter.component.scss'],
  standalone: false,
})
export class AudioMeterComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChildren('bar') bars!: QueryList<ElementRef<HTMLDivElement>>;

  @Input() orientation: 'vertical' | 'horizontal' = 'vertical';
  @Input() size: 'normal' | 'compact' = 'normal';
  @Input() segments: number = 10;
  @Input() stream: MediaStream | null = null; // extern pass

  private readonly log = createLogger('AudioMeterComponent');
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private meterTimerId: number | null = null;
  private viewReady = false;

  async ngAfterViewInit(): Promise<void> {
    this.viewReady = true;
    await this.restartAudio();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['stream']) {
      await this.restartAudio();
    }
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  private async restartAudio(): Promise<void> {
    if (!this.viewReady) return;

    if (this.stream) {
      await this.initAudio(this.stream);
    } else {
      this.stopAudio();
    }
  }

  private async initAudio(stream: MediaStream): Promise<void> {
    this.stopAudio(); // falls schon aktiv

    try {
      if (stream.getAudioTracks().length === 0) {
        this.resetBars();
        return;
      }

      this.audioContext = new AudioContext();
      await this.audioContext.resume().catch(() => undefined);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.meterTimerId = window.setInterval(() => this.updateMeter(), 80);
      this.updateMeter();
    } catch (err) {
      this.log.error('AudioMeter could not be initialized:', err);
    }
  }

  private stopAudio(): void {
    if (this.meterTimerId !== null) {
      window.clearInterval(this.meterTimerId);
      this.meterTimerId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.sourceNode = null;

    this.resetBars();
  }

  private updateMeter(): void {
    if (!this.analyser) return;
    if (!this.bars) return;

    if (this.audioContext?.state === 'suspended') {
      void this.audioContext.resume().catch(() => undefined);
    }

    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = (dataArray[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const level = Math.min(1, rms * 4);

    const activeBars = Math.round(level * this.segments);

    this.bars.forEach((bar, index) => {
      if (index < activeBars) {
        if (index < this.segments * 0.6) {
          bar.nativeElement.style.background = 'limegreen';
        } else if (index < this.segments * 0.8) {
          bar.nativeElement.style.background = 'yellow';
        } else {
          bar.nativeElement.style.background = 'red';
        }
      } else {
        bar.nativeElement.style.background = '#333';
      }
    });

  }

  private resetBars(): void {
    if (!this.bars) return;

    this.bars.forEach((bar) => (bar.nativeElement.style.background = '#333'));
  }
}
