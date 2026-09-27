import fs from 'fs';
import path from 'path';
import cloudinary from '../config/cloudinary';
import { logger } from '../middlewares/logger';

function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

export async function deleteImage(img: string | undefined | null): Promise<void> {
  if (!img) return;
  if (img.startsWith('http')) {
    const publicId = extractPublicId(img);
    if (!publicId) {
      logger.error(`No se pudo extraer el public_id de la URL de Cloudinary: ${img}`);
      return;
    }
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      logger.error(`Error al borrar imagen de Cloudinary (${publicId}):`, error);
    }
    return;
  }

  const filepath = path.join(process.cwd(), 'public', img);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
}
