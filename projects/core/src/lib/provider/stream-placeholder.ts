/** Cached canvas artwork used inside the outgoing mixer, not as a UI overlay. */
export function createStreamPlaceholder(
  width: number, height: number, logo?: HTMLImageElement,
  background = '#e9ecef', foreground = '#6c757d',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / 1920, height / 1080);
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  if (logo?.complete && logo.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = .3;
    ctx.filter = 'grayscale(1)';
    const size = 96;
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const w = ratio >= 1 ? size : size * ratio;
    const h = ratio >= 1 ? size / ratio : size;
    ctx.drawImage(logo, -w / 2, -100, w, h);
    ctx.restore();
  }
  ctx.font = '500 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 255, 255, .2)';
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur = 0;
  ctx.globalAlpha = .45;
  ctx.fillStyle = foreground;
  ctx.fillText('Live Stream', 0, 28);
  return canvas;
}
