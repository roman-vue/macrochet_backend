// Uso: npm run migrate:cloudinary [-- --dry-run]
// Migra las imágenes que todavía están en /uploads/ (paths relativos tipo /uploads/x.jpg)
// hacia Cloudinary, para Product.images y Carousel.image. Las imágenes viven en el
// servidor de producción (BACKEND_PUBLIC_URL), no en el disco de donde se corre este
// script, así que se suben por URL remota — Cloudinary las descarga él mismo.
// Idempotente: cualquier valor que ya empiece con http se saltea.
import 'dotenv/config';
import { connectDB } from '../src/config/database';
import cloudinary from '../src/config/cloudinary';
import { Product } from '../src/models/Product';
import { Carousel } from '../src/models/Carousel';
import mongoose from 'mongoose';

const DRY_RUN = process.argv.includes('--dry-run');
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL ?? 'http://45.79.252.193:3033';

const summary = {
  migrated: 0,
  alreadyMigrated: 0,
  errors: 0,
};

async function migrateLocalPath(localPath: string, label: string): Promise<string | null> {
  if (localPath.startsWith('http')) {
    summary.alreadyMigrated++;
    return null;
  }

  const remoteUrl = `${BACKEND_PUBLIC_URL}${localPath}`;

  if (DRY_RUN) {
    console.log(`[dry-run] migraría ${label}: ${remoteUrl}`);
    summary.migrated++;
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(remoteUrl, { folder: 'macrochet' });
    console.log(`[migrado] ${label}: ${remoteUrl} -> ${result.secure_url}`);
    summary.migrated++;
    return result.secure_url;
  } catch (error) {
    console.error(`[error] ${label}: ${remoteUrl}`, error);
    summary.errors++;
    return null;
  }
}

async function migrateProducts() {
  const products = await Product.find({ images: { $regex: '^/uploads/' } });
  for (const product of products) {
    let changed = false;
    const newImages: string[] = [];
    for (const img of product.images) {
      const newUrl = await migrateLocalPath(img, `producto "${product.name}" (${product._id})`);
      if (newUrl) {
        newImages.push(newUrl);
        changed = true;
      } else {
        newImages.push(img);
      }
    }
    if (changed && !DRY_RUN) {
      product.images = newImages;
      await product.save();
    }
  }
}

async function migrateCarousel() {
  const slides = await Carousel.find({ image: { $regex: '^/uploads/' } });
  for (const slide of slides) {
    const newUrl = await migrateLocalPath(slide.image, `carousel "${slide.title || slide._id}"`);
    if (newUrl && !DRY_RUN) {
      slide.image = newUrl;
      await slide.save();
    }
  }
}

async function main() {
  await connectDB();

  console.log(DRY_RUN ? '=== DRY RUN (no se sube ni se guarda nada) ===' : '=== Migrando imágenes a Cloudinary ===');

  await migrateProducts();
  await migrateCarousel();

  console.log('\n--- Resumen ---');
  console.log(`Migradas:        ${summary.migrated}`);
  console.log(`Ya migradas:     ${summary.alreadyMigrated}`);
  console.log(`Errores:         ${summary.errors}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
