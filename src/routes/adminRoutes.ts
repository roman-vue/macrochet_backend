import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Color } from '../models/Color';
import { Announcement } from '../models/Announcement';
import { Carousel } from '../models/Carousel';
import { requireLogin } from '../middlewares/sessionAuth';
import { upload } from '../middlewares/upload';
import { deleteImage } from '../utils/imageStorage';

const router = Router();

// Wraps async handlers so errors reach the global error handler (Express 4)
function a(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const USERS: Record<string, string> = {
  amarcela: 'amarcela',
  admin: 'piji2022*',
};

router.get('/login', (req: Request, res: Response) => {
  if ((req.session as any).user) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  if (USERS[username] && USERS[username] === password) {
    (req.session as any).user = username;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Usuario o contraseña incorrectos.' });
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/admin', requireLogin, a(async (_req, res) => {
  const [productCount, colors, categories, stockAgg] = await Promise.all([
    Product.countDocuments(),
    Color.countDocuments(),
    Product.distinct('category'),
    Product.aggregate([{ $group: { _id: null, totalStock: { $sum: '$stock' }, totalValue: { $sum: { $multiply: ['$price', '$stock'] } } } }]),
  ]);
  const agg = stockAgg[0] ?? { totalStock: 0, totalValue: 0 };
  res.render('admin/dashboard', {
    path: '/admin',
    stats: { products: productCount, colors, categories: categories.length, totalStock: agg.totalStock, totalValue: agg.totalValue },
  });
}));

// ── Products ──────────────────────────────────────────────────────────────────

router.get('/admin/products', requireLogin, a(async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.render('admin/products/index', { path: '/admin/products', products, error: null, success: null });
}));

router.get('/admin/products/create', requireLogin, a(async (_req, res) => {
  const [colors, categories] = await Promise.all([
    Color.find().sort({ name: 1 }),
    Product.distinct('category'),
  ]);
  res.render('admin/products/create', { path: '/admin/products', colors, categories, error: null, success: null });
}));

router.post('/admin/products', requireLogin, upload.array('images', 10), a(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const images = files.map(f => f.path);

  const { name, description, price, stock, category, isBestseller } = req.body as Record<string, string>;
  const colorIds: string[] = req.body.colors
    ? Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors]
    : [];

  const product = await Product.create({
    name,
    description,
    price: parseFloat(price),
    stock: parseInt(stock ?? '0', 10),
    category,
    isBestseller: isBestseller === 'true',
    colors: colorIds,
    images,
  });

  const [allColors, allCategories] = await Promise.all([
    Color.find().sort({ name: 1 }),
    Product.distinct('category'),
  ]);
  res.render('admin/products/create', {
    path: '/admin/products',
    colors: allColors,
    categories: allCategories,
    error: null,
    success: `Producto "${product.name}" creado correctamente.`,
  });
}));

router.get('/admin/products/:id/edit', requireLogin, a(async (req, res) => {
  const [product, colors, categories] = await Promise.all([
    Product.findById(req.params.id),
    Color.find().sort({ name: 1 }),
    Product.distinct('category'),
  ]);
  if (!product) return res.redirect('/admin/products');
  res.render('admin/products/edit', { path: '/admin/products', product, colors, categories, error: null, success: null });
}));

router.post('/admin/products/:id', requireLogin, upload.array('images', 10), a(async (req, res) => {
  const { name, description, price, stock, category, isBestseller } = req.body as Record<string, string>;
  const colorIds: string[] = req.body.colors
    ? Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors]
    : [];

  const product = await Product.findById(req.params.id);
  if (!product) return res.redirect('/admin/products');

  // Remove images marked for deletion
  const toRemove: string[] = req.body.removeImages
    ? Array.isArray(req.body.removeImages) ? req.body.removeImages : [req.body.removeImages]
    : [];
  await Promise.all(toRemove.map(img => deleteImage(img)));

  // Append new uploaded images
  const newImages = ((req.files as Express.Multer.File[]) ?? []).map(f => f.path);
  const updatedImages = [...product.images.filter(img => !toRemove.includes(img)), ...newImages];

  await Product.findByIdAndUpdate(req.params.id, {
    name, description,
    price: parseFloat(price),
    stock: parseInt(stock ?? '0', 10),
    category,
    isBestseller: isBestseller === 'true',
    colors: colorIds,
    images: updatedImages,
  });

  const [updatedProduct, colors, categories] = await Promise.all([
    Product.findById(req.params.id),
    Color.find().sort({ name: 1 }),
    Product.distinct('category'),
  ]);
  res.render('admin/products/edit', {
    path: '/admin/products',
    product: updatedProduct,
    colors,
    categories,
    error: null,
    success: 'Producto actualizado correctamente.',
  });
}));

router.post('/admin/products/:id/stock', requireLogin, a(async (req, res) => {
  const stock = parseInt(req.body.stock ?? '0', 10);
  await Product.findByIdAndUpdate(req.params.id, { stock: Math.max(0, stock) });
  const products = await Product.find().sort({ createdAt: -1 });
  res.render('admin/products/index', { path: '/admin/products', products, error: null, success: 'Stock actualizado.' });
}));

router.post('/admin/products/:id/bestseller', requireLogin, a(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) await Product.findByIdAndUpdate(req.params.id, { isBestseller: !product.isBestseller });
  const products = await Product.find().sort({ createdAt: -1 });
  res.render('admin/products/index', { path: '/admin/products', products, error: null, success: null });
}));

router.post('/admin/products/:id/delete', requireLogin, a(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (product?.images?.length) {
    await Promise.all(product.images.map(img => deleteImage(img)));
  }
  const products = await Product.find().sort({ createdAt: -1 });
  res.render('admin/products/index', {
    path: '/admin/products', products, error: null,
    success: product ? `Producto "${product.name}" eliminado.` : 'Producto eliminado.',
  });
}));

// ── Colors ────────────────────────────────────────────────────────────────────

router.get('/admin/colors', requireLogin, a(async (_req, res) => {
  const colors = await Color.find().sort({ name: 1 });
  res.render('admin/colors/index', { path: '/admin/colors', colors, error: null, success: null });
}));

router.post('/admin/colors', requireLogin, a(async (req, res) => {
  const { name, hex } = req.body as { name: string; hex: string };

  const exists = await Color.findOne({ $or: [{ name }, { hex }] });
  if (exists) {
    const colors = await Color.find().sort({ name: 1 });
    return res.render('admin/colors/index', {
      path: '/admin/colors', colors, success: null,
      error: 'Ya existe un color con ese nombre o código hex.',
    });
  }

  await Color.create({ name, hex });
  const colors = await Color.find().sort({ name: 1 });
  res.render('admin/colors/index', {
    path: '/admin/colors', colors, error: null,
    success: `Color "${name}" registrado.`,
  });
}));

router.post('/admin/colors/:id/delete', requireLogin, a(async (req, res) => {
  await Color.findByIdAndDelete(req.params.id);
  const colors = await Color.find().sort({ name: 1 });
  res.render('admin/colors/index', {
    path: '/admin/colors', colors, error: null,
    success: 'Color eliminado.',
  });
}));

// ── Announcements ─────────────────────────────────────────────────────────────

router.get('/admin/announcements', requireLogin, a(async (_req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  res.render('admin/announcements/index', { path: '/admin/announcements', announcements, editing: null, error: null, success: null });
}));

router.get('/admin/announcements/:id/edit', requireLogin, a(async (req, res) => {
  const [announcements, editing] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }),
    Announcement.findById(req.params.id),
  ]);
  if (!editing) return res.redirect('/admin/announcements');
  res.render('admin/announcements/index', { path: '/admin/announcements', announcements, editing, error: null, success: null });
}));

router.post('/admin/announcements', requireLogin, a(async (req, res) => {
  const { title, message, status } = req.body as Record<string, string>;
  await Announcement.create({ title, message, status: status === 'true' });
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  res.render('admin/announcements/index', {
    path: '/admin/announcements', announcements, editing: null, error: null,
    success: `Anuncio "${title}" creado.`,
  });
}));

router.post('/admin/announcements/:id', requireLogin, a(async (req, res) => {
  const { title, message, status } = req.body as Record<string, string>;
  await Announcement.findByIdAndUpdate(req.params.id, { title, message, status: status === 'true' });
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  res.render('admin/announcements/index', {
    path: '/admin/announcements', announcements, editing: null, error: null,
    success: 'Anuncio actualizado.',
  });
}));

router.post('/admin/announcements/:id/toggle', requireLogin, a(async (req, res) => {
  const ann = await Announcement.findById(req.params.id);
  if (ann) await Announcement.findByIdAndUpdate(req.params.id, { status: !ann.status });
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  res.render('admin/announcements/index', {
    path: '/admin/announcements', announcements, editing: null, error: null,
    success: ann ? `Anuncio "${ann.title}" ${!ann.status ? 'activado' : 'desactivado'}.` : null,
  });
}));

router.post('/admin/announcements/:id/delete', requireLogin, a(async (req, res) => {
  const ann = await Announcement.findByIdAndDelete(req.params.id);
  const announcements = await Announcement.find().sort({ createdAt: -1 });
  res.render('admin/announcements/index', {
    path: '/admin/announcements', announcements, editing: null, error: null,
    success: ann ? `Anuncio "${ann.title}" eliminado.` : 'Anuncio eliminado.',
  });
}));

// ── Carousel ──────────────────────────────────────────────────────────────────

router.get('/admin/carousel', requireLogin, a(async (_req, res) => {
  const slides = await Carousel.find().sort({ order: 1, createdAt: 1 });
  res.render('admin/carousel/index', { path: '/admin/carousel', slides, error: null, success: null });
}));

router.post('/admin/carousel', requireLogin, upload.single('image'), a(async (req, res) => {
  const file = req.file;
  if (!file) {
    const slides = await Carousel.find().sort({ order: 1, createdAt: 1 });
    return res.render('admin/carousel/index', { path: '/admin/carousel', slides, success: null, error: 'Debes seleccionar una imagen.' });
  }
  const { title, order, active } = req.body as Record<string, string>;
  await Carousel.create({
    image: file.path,
    title: title ?? '',
    order: parseInt(order ?? '0', 10),
    active: active === 'true',
  });
  const slides = await Carousel.find().sort({ order: 1, createdAt: 1 });
  res.render('admin/carousel/index', { path: '/admin/carousel', slides, error: null, success: 'Diapositiva agregada.' });
}));

router.post('/admin/carousel/:id/order', requireLogin, a(async (req, res) => {
  const order = parseInt(req.body.order ?? '0', 10);
  await Carousel.findByIdAndUpdate(req.params.id, { order: Math.max(0, order) });
  const slides = await Carousel.find().sort({ order: 1, createdAt: 1 });
  res.render('admin/carousel/index', { path: '/admin/carousel', slides, error: null, success: 'Orden actualizado.' });
}));

router.post('/admin/carousel/:id/toggle', requireLogin, a(async (req, res) => {
  const slide = await Carousel.findById(req.params.id);
  if (slide) await Carousel.findByIdAndUpdate(req.params.id, { active: !slide.active });
  const slides = await Carousel.find().sort({ order: 1, createdAt: 1 });
  res.render('admin/carousel/index', { path: '/admin/carousel', slides, error: null, success: null });
}));

router.post('/admin/carousel/:id/delete', requireLogin, a(async (req, res) => {
  const slide = await Carousel.findByIdAndDelete(req.params.id);
  if (slide?.image) {
    await deleteImage(slide.image);
  }
  const slides = await Carousel.find().sort({ order: 1, createdAt: 1 });
  res.render('admin/carousel/index', { path: '/admin/carousel', slides, error: null, success: 'Diapositiva eliminada.' });
}));

// ── Categories ────────────────────────────────────────────────────────────────

router.get('/admin/categories', requireLogin, a(async (_req, res) => {
  const categories = (await Product.distinct('category')).sort();
  res.render('admin/categories/index', { path: '/admin/categories', categories });
}));

export default router;
