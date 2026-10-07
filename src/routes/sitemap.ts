import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { logger } from '../middlewares/logger';

const router = Router();
const SITE_URL = 'https://macrochet.com';

// Debe coincidir con productPath() del front: /productos/<slug>-<id>
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.get('/sitemap.xml', async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({}, '_id name updatedAt').sort({ updatedAt: -1 }).lean();

    const urls = [
      `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      ...products.map(
        (p) =>
          `  <url>\n    <loc>${SITE_URL}/productos/${slugify(p.name) ? `${slugify(p.name)}-` : ''}${p._id}</loc>\n    <lastmod>${p.updatedAt.toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    logger.error('Error generando sitemap', { err });
    res.status(500).send('Error generando sitemap');
  }
});

export default router;
