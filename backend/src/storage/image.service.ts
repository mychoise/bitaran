import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { nepalNow } from '../common/utils/date.util.js';

@Injectable()
export class ImageService {
  /**
   * Draws the Nepal date and time of `date` in the bottom-right corner and
   * returns the stamped image in its original format. Stamp before upload:
   * the stamped buffer is what gets stored.
   *
   * The image is first turned upright from its EXIF orientation, so the stamp
   * lands in the corner people actually see. Metadata (EXIF, including GPS)
   * is not carried over, so read anything needed from it before stamping.
   */
  async stampDate(buffer: Buffer, date: Date): Promise<Buffer> {
    const { data, info } = await sharp(buffer)
      .rotate()
      .toBuffer({ resolveWithObject: true });
    const text = `${nepalNow(date)} NPT`;

    // Size the label to the image; shrink it if it would not fit across.
    let fontSize = Math.max(
      12,
      Math.round(Math.min(info.width, info.height) * 0.045),
    );
    const widthFor = (size: number) =>
      Math.ceil(size * 0.62 * text.length + size);
    if (widthFor(fontSize) > info.width) {
      fontSize = Math.max(6, Math.floor(info.width / (0.62 * text.length + 1)));
    }
    const pad = Math.round(fontSize * 0.4);
    const boxW = Math.min(info.width, widthFor(fontSize));
    const boxH = Math.min(info.height, fontSize + pad * 2);

    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}">` +
        `<rect width="100%" height="100%" fill="#000" fill-opacity="0.6"/>` +
        `<text x="${pad}" y="${pad + fontSize * 0.82}" font-family="DejaVu Sans, Arial, sans-serif" ` +
        `font-size="${fontSize}" fill="#fff">${text}</text></svg>`,
    );

    let out = sharp(data).composite([{ input: label, gravity: 'southeast' }]);
    // Compositing adds an alpha channel; keep an opaque image opaque.
    if (info.channels === 3) out = out.removeAlpha();
    switch (info.format) {
      case 'png':
        return out.png().toBuffer();
      case 'webp':
        return out.webp({ quality: 90 }).toBuffer();
      default:
        return out.jpeg({ quality: 90 }).toBuffer();
    }
  }
}
