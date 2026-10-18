import {CommonModule} from '@angular/common';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {OverlayContainer, OverlayModule} from '@angular/cdk/overlay';
import {BehaviorSubject} from 'rxjs';
import {GuestComponent} from './guest.component';
import {AudioMeterComponent} from '../audio-meter/audio-meter.component';
import {SettingsPanelComponent} from '../settings-panel/settings-panel.component';
import {LobbyService} from '../../provider/lobby.service';
import {StreamMixerService} from '../../provider/stream-mixer.service';
import {LobbyMediaStream} from '../../entities';

describe('Guest audio settings', () => {
  it('keeps volume changes connected to the mixer and destroys the meter when closed', async () => {
    const setVolume = jasmine.createSpy('setVolume');
    TestBed.configureTestingModule({
      declarations: [GuestComponent, AudioMeterComponent],
      imports: [CommonModule, OverlayModule, SettingsPanelComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {provide: LobbyService, useValue: {mute$: new BehaviorSubject(null)}},
        {provide: StreamMixerService, useValue: {setVolume}},
      ],
    });
    const fixture = TestBed.createComponent(GuestComponent);
    fixture.componentInstance.media = LobbyMediaStream.buildLocal('Guest', new MediaStream());
    fixture.componentInstance.onHost = true;
    fixture.componentInstance.deactivateGuestStreamCbk = () => {};
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.guest-audio-mixer-toggle').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    expect(container.querySelector('[role="tab"]')!.textContent).toContain('Audio');
    expect(container.querySelector('.meter.light')).not.toBeNull();
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.value = '1.5';
    slider.dispatchEvent(new Event('input', {bubbles: true}));
    fixture.detectChanges();
    expect(setVolume).toHaveBeenCalledWith(`video-${fixture.componentInstance.media.streamId}`, 1.5);
    expect(container.querySelector('output')!.textContent).toContain('150%');
    const cleanup = spyOn(AudioMeterComponent.prototype as any, 'stopAudio').and.callThrough();
    container.querySelector<HTMLButtonElement>('.settings-panel-close')!.click();
    fixture.detectChanges();
    expect(cleanup).toHaveBeenCalled();
    expect(container.querySelector('.settings-panel')).toBeNull();
    fixture.destroy();
  });
});
