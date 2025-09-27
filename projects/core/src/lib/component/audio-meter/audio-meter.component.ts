import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-audio-meter',
  templateUrl: './audio-meter.component.html',
  styleUrls: ['./audio-meter.component.scss'],
  standalone: false,
})
export class AudioMeterComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChildren('bar') bars!: QueryList<ElementRef<HTMLDivElement>>;

  @Input() orientation: 'vertical' | 'horizontal' = 'vertical';
  @Input() segments: number = 10;
  @Input() stream: MediaStream | null = null; // extern übergeben

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;

  async ngOnInit(): Promise<void> {
    if (this.stream) {
      await this.initAudio(this.stream);
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['stream']) {
      if (this.stream) {
        await this.initAudio(this.stream);
      } else {
        this.stopAudio();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopAudio();
  }

  private async initAudio(stream: MediaStream): Promise<void> {
    this.stopAudio(); // falls schon aktiv

    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.updateMeter();
    } catch (err) {
      console.error('AudioMeter konnte nicht initialisiert werden:', err);
    }
  }

  private stopAudio(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.sourceNode = null;

    // Bars zurücksetzen
    if (this.bars) {
      this.bars.forEach((bar) => (bar.nativeElement.style.background = '#333'));
    }
  }

  private updateMeter(): void {
    if (!this.analyser) return;

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

    this.animationFrameId = requestAnimationFrame(() => this.updateMeter());
  }
}
