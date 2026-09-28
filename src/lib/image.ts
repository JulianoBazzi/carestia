/**
 * Preparação de foto no NAVEGADOR (aba "Etiqueta" do scanner). Um único caminho
 * via `<img>` + canvas: os navegadores aplicam a orientação EXIF ao desenhar um
 * `<img>`, então a foto em retrato do celular não chega deitada ao modelo.
 */

/** Carrega o arquivo num `<img>` (object URL liberado ao terminar). */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a imagem.'));
    };
    img.src = url;
  });
}

/**
 * Reduz a imagem para caber em `maxSide` px no lado maior e devolve um data URL
 * JPEG. Mantém a foto leve o bastante para o upload (e para o custo de visão do
 * modelo) sem perder a legibilidade dos dígitos da etiqueta.
 */
export function downscaleToJpeg(img: HTMLImageElement, maxSide = 1280, quality = 0.8): string {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas indisponível neste navegador.');
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Tenta ler um código de barras de produto direto da foto, no aparelho. Quando
 * encontra, esse valor é mais confiável que o EAN "lido" pelo modelo de visão
 * (que troca dígitos com facilidade). Falha silenciosa: devolve `null`.
 */
export async function detectBarcode(img: HTMLImageElement): Promise<string | null> {
  try {
    const { BarcodeDetector } = await import('barcode-detector/ponyfill');
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const found = await detector.detect(img);
    return found[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}
