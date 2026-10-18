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
  for (const width of [320, 390, 575, 576, 800, 1280, 1600]) {
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
            <header style="height:100px"></header>
            <div class="lobby">
              <div class="lobby-host-notice">Waiting for host...</div>
              <div class="app-main">
                <div class="navigation">
                  <h1 class="lobby-title">A long stream title that must stay inside its column</h1>
                  <span class="lobby-phase">${joined ? 'Stream Lobby' : 'Waiting Room'}</span>
                  <div class="nav-group right"><div class="nav-group-area">
                    <span class="lobby-live-status"><span class="lobby-live-dot"></span>
                      <span class="lobby-status-label">Offline</span></span>
                    <button class="nav-icon-button icon"><svg></svg>
                      ${joined ? '' : '<span class="lobby-action-label">Join Lobby</span>'}</button>
                    <button class="nav-icon-button icon"><svg></svg></button>
                    <button class="nav-icon-button icon"><svg></svg></button>
                  </div></div>
                </div>
                <div class="video-call-wrapper">
                  <div class="${joined ? 'stream-video' : 'lobby-setup-preview'}">${joined ? '<div class="lobby-empty-stream">No Live Stream</div>' : ''}</div>
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
          expect(title.left).toBeGreaterThanOrEqual(header.left);
          expect(title.right).toBeLessThanOrEqual(actions.left);
          expect(actions.right).toBeLessThanOrEqual(header.right);
          const button = rect('.nav-icon-button');
          expect(status.right).toBeLessThanOrEqual(button.left);
          expect(status.height).toBe(button.height);
          const notice = rect('.lobby-host-notice');
          expect(Math.abs(notice.left + notice.width / 2 - width / 2)).toBeLessThan(1);
          expect(notice.top).toBe(30);
          expect(notice.width).toBeLessThanOrEqual(Math.min(360, width - 32));
          expect(notice.bottom).toBeLessThanOrEqual(button.top + 1);
          expect(frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-host-notice')!).pointerEvents).toBe('none');
          const titleStyle = frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-title')!);
          expect(titleStyle.textAlign).toBe('left');
          expect(titleStyle.fontSize).toBe('16px');
          const statusStyle = frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-live-status')!);
          expect(statusStyle.borderTopStyle).toBe('solid');
          expect(statusStyle.borderTopWidth).toBe('1px');
          const mainStyle = frame.contentWindow!.getComputedStyle(doc.querySelector('.app-main')!);
          const availableWidth = rect('.app-main').width - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight);
          const phase = doc.querySelector('.lobby-phase')!;
          expect(frame.contentWindow!.getComputedStyle(phase).display).toBe(availableWidth >= 1000 ? 'block' : 'none');
          if (availableWidth >= 1000) {
            const phaseRect = rect('.lobby-phase');
            expect(Math.abs(phaseRect.left + phaseRect.width / 2 - (header.left + header.width / 2))).toBeLessThan(1);
            expect(title.right).toBeLessThanOrEqual(phaseRect.left);
            expect(phaseRect.right).toBeLessThanOrEqual(actions.left);
          }
          expect(frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-status-label')!).display)
            .toBe(availableWidth < 576 ? 'none' : 'block');
          expect(media.height).toBeGreaterThan(170);
          if (joined) {
            const empty = rect('.lobby-empty-stream');
            expect(empty.width).toBeLessThanOrEqual(media.width);
            expect(empty.height).toBeLessThanOrEqual(media.height);
            expect(frame.contentWindow!.getComputedStyle(doc.querySelector('.lobby-empty-stream')!).pointerEvents).toBe('none');
          }
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
