import {AudioMeterComponent} from './audio-meter.component';

describe('Audio meter lifecycle', () => {
  it('does not restart measurement if its panel closes during audio initialization', async () => {
    let resume!: () => void;
    const context = {
      resume: () => new Promise<void>(resolve => resume = resolve),
      close: jasmine.createSpy('close').and.resolveTo(),
      createAnalyser: jasmine.createSpy('createAnalyser'),
    };
    spyOn(window as any, 'AudioContext').and.returnValue(context);
    const meter = new AudioMeterComponent();
    meter.stream = {getAudioTracks: () => [{}]} as MediaStream;
    const initializing = meter.ngAfterViewInit();
    meter.ngOnDestroy();
    resume();
    await initializing;
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.createAnalyser).not.toHaveBeenCalled();
  });
});
