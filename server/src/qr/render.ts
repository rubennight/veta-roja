import QRCode from 'qrcode';

const COMMON = { errorCorrectionLevel: 'M', margin: 4 } as const;

export function renderQr(text: string, format: 'svg'): Promise<string>;
export function renderQr(text: string, format: 'png'): Promise<Buffer>;
export function renderQr(text: string, format: 'svg' | 'png'): Promise<string | Buffer> {
  if (format === 'svg') return QRCode.toString(text, { ...COMMON, type: 'svg' });
  return QRCode.toBuffer(text, { ...COMMON, type: 'png', width: 1024 });
}
