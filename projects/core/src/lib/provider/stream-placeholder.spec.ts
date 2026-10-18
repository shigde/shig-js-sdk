import {createStreamPlaceholder} from './stream-placeholder';
import {StreamMixerService} from './stream-mixer.service';

describe('Mixer stream placeholder', () => {
  it('uses the supplied dark palette without a light canvas background', () => {
    const canvas = createStreamPlaceholder(1920, 1080, undefined, '#343a40', '#adb5bd');
    expect(Array.from(canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data))
      .toEqual([52, 58, 64, 255]);
  });

  it('draws the provided hand logo into the cached artwork', async () => {
    const image = new Image();
    image.src = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="black"/></svg>');
    await image.decode();
    const draw = spyOn(CanvasRenderingContext2D.prototype, 'drawImage').and.callThrough();
    createStreamPlaceholder(1920, 1080, image);
    expect(Array.from(draw.calls.argsFor(0))).toEqual([image, -48, -100, 96, 96]);
  });

  it('renders an opaque neutral background with artwork in the canvas', () => {
    const canvas = createStreamPlaceholder(1920, 1080);
    const ctx = canvas.getContext('2d')!;
    expect(Array.from(ctx.getImageData(0, 0, 1, 1).data)).toEqual([233, 236, 239, 255]);
    const pixels = ctx.getImageData(800, 450, 320, 160).data;
    let artworkPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 220 && pixels[i + 3] === 255) artworkPixels++;
    }
    expect(artworkPixels).toBeGreaterThan(100);
  });

  it('reuses the same background canvas for subsequent mixer frames', () => {
    const mixer = new StreamMixerService({} as any);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const draw = spyOn(ctx, 'drawImage');
    const tile = {x: 10, y: 20, width: 300, height: 200};
    (mixer as any).drawNoVideoPlaceholder(tile, ctx);
    (mixer as any).drawNoVideoPlaceholder(tile, ctx);
    expect(draw.calls.count()).toBe(2);
    expect(draw.calls.argsFor(0)[0]).toBe(draw.calls.argsFor(1)[0]);
    expect(draw.calls.argsFor(0).slice(1)).toEqual([10, 20, 300, 200]);
  });
});
