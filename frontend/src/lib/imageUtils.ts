// Resize an image file to a max dimension and return a base64 data URL (jpeg/png).
// Returns null if not an image or size limit exceeded after resize.
export async function fileToResizedDataUrl(
  file: File,
  opts: { maxDim?: number; quality?: number; maxBytes?: number; mimeType?: 'image/jpeg' | 'image/png' | 'image/webp' } = {},
): Promise<string | null> {
  const { maxDim = 800, quality = 0.85, maxBytes = 400_000, mimeType = 'image/jpeg' } = opts;
  if (!file.type.startsWith('image/')) return null;

  const img = await loadImage(file);
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let q = quality;
  let dataUrl = canvas.toDataURL(mimeType, q);
  // Step down quality if too large
  while (dataUrl.length > maxBytes && q > 0.4) {
    q -= 0.1;
    dataUrl = canvas.toDataURL(mimeType, q);
  }
  if (dataUrl.length > maxBytes) return null;
  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Approximate base64 size in bytes
export function dataUrlSize(url: string): number {
  return Math.floor((url.length * 3) / 4);
}
