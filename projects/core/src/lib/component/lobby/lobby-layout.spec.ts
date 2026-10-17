import {Component, ViewEncapsulation} from '@angular/core';
import {TestBed} from '@angular/core/testing';

@Component({
  standalone: true,
  template: '',
  styleUrls: [
    '../../../../assets/scss/lobby.scss',
    './lobby.component.scss',
  ],
  encapsulation: ViewEncapsulation.None,
})
class LayoutStyles {}

describe('Lobby responsive layout', () => {
  for (const width of [320, 390, 575, 576, 800, 1280]) {
    for (const joined of [false, true]) {
      it(`keeps guest media and participants below the header at ${width}px (${joined ? 'joined' : 'setup'})`, async () => {
        const fixture = TestBed.createComponent(LayoutStyles);
        fixture.detectChanges();
        const frame = document.createElement('iframe');
        frame.style.cssText = `width:${width}px;height:900px;position:fixed;left:0;top:0;border:0`;
        document.body.append(frame);
        try {
          const doc = frame.contentDocument!;
          for (const style of Array.from(document.querySelectorAll('style'))) {
            doc.head.append(style.cloneNode(true));
          }
          doc.body.innerHTML = `
            <div class="lobby">
              <div class="app-main">
                <div class="navigation">
                  <div class="nav-group"><div class="nav-group-area">
                    <span class="lobby-live-status"><span class="lobby-live-dot"></span>
                      <span class="lobby-status-label">Offline</span></span>
                  </div></div>
                  <h1 class="lobby-title">A long stream title that must stay inside its column</h1>
                  <div class="nav-group right"><div class="nav-group-area">
                    <button class="nav-icon-button icon"><svg></svg>
                      ${joined ? '' : '<span class="lobby-action-label">Join Stream</span>'}</button>
                    <button class="nav-icon-button icon"><svg></svg></button>
                    <button class="nav-icon-button icon"><svg></svg></button>
                  </div></div>
                </div>
                <div class="video-call-wrapper">
                  <div class="${joined ? 'stream-video' : 'lobby-setup-preview'}"></div>
                </div>
              </div>
              <div class="right-side"><div class="guest-container">
                <div class="guest-header">Guests</div>
                <div class="guest-area"><div class="guest-video"></div><div class="guest-video"></div></div>
              </div></div>
            </div>`;
          await new Promise(resolve => frame.contentWindow!.requestAnimationFrame(resolve));
          const rect = (selector: string) => doc.querySelector(selector)!.getBoundingClientRect();
          const header = rect('.navigation');
          const media = rect('.video-call-wrapper');
          const title = rect('.lobby-title');
          const status = rect('.lobby-live-status');
          const actions = rect('.nav-group.right');
          expect(Math.abs((title.top + title.height / 2) - (actions.top + actions.height / 2))).toBeLessThan(1);
          expect(title.left).toBeGreaterThanOrEqual(status.right);
          expect(title.right).toBeLessThanOrEqual(actions.left);
          expect(actions.right).toBeLessThanOrEqual(header.right);
          const titleStyle = frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-title')!);
          expect(titleStyle.textAlign).toBe('left');
          expect(titleStyle.fontSize).toBe('16px');
          const statusStyle = frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-live-status')!);
          expect(statusStyle.borderTopStyle).toBe('solid');
          expect(statusStyle.borderTopWidth).toBe('1px');
          const mainStyle = frame.contentWindow!.getComputedStyle(doc.querySelector('.app-main')!);
          const availableWidth = rect('.app-main').width - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight);
          expect(frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-status-label')!).display)
            .toBe(availableWidth < 576 ? 'none' : 'block');
          expect(media.height).toBeGreaterThan(170);
          expect(media.top).toBeGreaterThanOrEqual(header.bottom);
          if (width <= 900) {
            expect(rect('.right-side').top).toBeGreaterThanOrEqual(media.bottom);
          }
          expect(rect('.lobby').right).toBeLessThanOrEqual(width);
        } finally {
          frame.remove();
          fixture.destroy();
        }
      });
    }
  }
});
