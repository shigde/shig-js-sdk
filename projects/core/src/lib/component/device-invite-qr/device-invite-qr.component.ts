import {Component, effect, ElementRef, input, signal, viewChild} from '@angular/core';
import QRCode from 'qrcode';

@Component({
  selector: 'shig-device-invite-qr',
  standalone: true,
  template: `
    <canvas #code class="img-fluid rounded" role="img" aria-label="Device invitation QR code"
            [hidden]="failed()"></canvas>
    @if (failed()) {
      <span class="text-body-secondary">QR code unavailable. Open the invitation link below.</span>
    }
  `,
})
export class DeviceInviteQrComponent {
  readonly url = input.required<string>();
  protected readonly failed = signal(false);
  private readonly code = viewChild<ElementRef<HTMLCanvasElement>>('code');

  constructor() {
    effect(() => {
      const canvas = this.code()?.nativeElement;
      if (canvas) {
        QRCode.toCanvas(canvas, this.url(), {width: 224}, error => this.failed.set(!!error));
      }
    });
  }
}
