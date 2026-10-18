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
      ...['privacidad', 'devoluciones', 'beneficios'].map(
        (slug) => `  <url>\n    <loc>${SITE_URL}/${slug}/</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>`
      ),
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

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Imagen absoluta en JPG (Cloudinary) para Merchant Center
function feedImage(src: string): string {
  if (src.startsWith('/')) return SITE_URL + src;
  return src.replace('/upload/', '/upload/w_1200,f_jpg,q_auto/');
}

// Feed de productos para Google Merchant Center (Netlify lo proxea desde /feed.xml)
router.get('/feed.xml', async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({}, '_id name description price images category stock').lean();

    const items = products.map((p) => {
      const link = `${SITE_URL}/productos/${slugify(p.name) ? `${slugify(p.name)}-` : ''}${p._id}`;
      const desc = p.description.split(/\n+/).map((l) => l.trim()).filter(Boolean)
        .map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)).join(' ');
      const [main, ...extra] = (p.images ?? []).map(feedImage);
      return [
        '    <item>',
        `      <g:id>${p._id}</g:id>`,
        `      <g:title>${esc(p.name)}</g:title>`,
        `      <g:description>${esc(desc.slice(0, 5000))}</g:description>`,
        `      <g:link>${link}</g:link>`,
        main ? `      <g:image_link>${esc(main)}</g:image_link>` : '',
        ...extra.slice(0, 10).map((u) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`),
        `      <g:availability>${p.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>`,
        `      <g:price>${p.price} COP</g:price>`,
        '      <g:condition>new</g:condition>',
        '      <g:brand>Macrochet</g:brand>',
        '      <g:identifier_exists>no</g:identifier_exists>',
        `      <g:product_type>${esc(p.category)}</g:product_type>`,
        '      <g:google_product_category>3032</g:google_product_category>',
        '    </item>',
      ].filter(Boolean).join('\n');
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Macrochet</title>\n    <link>${SITE_URL}</link>\n    <description>Bolsos tejidos a mano en crochet y macramé</description>\n${items.join('\n')}\n  </channel>\n</rss>\n`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    logger.error('Error generando feed de productos', { err });
    res.status(500).send('Error generando feed');
  }
});

export default router;
