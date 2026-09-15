import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { deleteImage } from '../utils/imageStorage';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  const { category, isBestseller, minPrice, maxPrice, color, page = '1', limit = '10' } = req.query;

  const filter: Record<string, unknown> = {};

  if (category) filter.category = { $regex: category as string, $options: 'i' };
  if (isBestseller !== undefined) filter.isBestseller = isBestseller === 'true';
  if (color) filter.colors = color;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) (filter.price as Record<string, number>).$gte = Number(minPrice);
    if (maxPrice) (filter.price as Record<string, number>).$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, parseInt(page as string));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter).populate('colors').skip(skip).limit(limitNum).sort({ createdAt: -1 }),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id).populate('colors');
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }
  res.json({ success: true, data: product });
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  const { name, description, price, category, colors, isBestseller, stock } = req.body;

  if (!name || !description || price === undefined || !category) {
    res.status(400).json({ success: false, message: 'name, description, price and category are required' });
    return;
  }

  if (isNaN(Number(price)) || Number(price) < 0) {
    res.status(400).json({ success: false, message: 'Price must be a positive number' });
    return;
  }

  const images = (req.files as Express.Multer.File[] | undefined)?.map((f) => f.path) ?? [];

  const colorsArr = colors
    ? (Array.isArray(colors) ? colors : [colors])
    : [];

  const product = await Product.create({
    name,
    description,
    price: Number(price),
    category,
    colors: colorsArr,
    isBestseller: isBestseller === 'true' || isBestseller === true,
    stock: stock ? Number(stock) : 0,
    images,
  });

  res.status(201).json({ success: true, data: product });
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  const { name, description, price, category, colors, isBestseller, stock } = req.body;

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0)) {
    res.status(400).json({ success: false, message: 'Price must be a positive number' });
    return;
  }

  const newImages = (req.files as Express.Multer.File[] | undefined)?.map((f) => f.path) ?? [];

  const updates: Partial<typeof product> = {};
  if (name) updates.name = name;
  if (description) updates.description = description;
  if (price !== undefined) updates.price = Number(price);
  if (category) updates.category = category;
  if (colors) updates.colors = Array.isArray(colors) ? colors : [colors];
  if (isBestseller !== undefined) updates.isBestseller = isBestseller === 'true' || isBestseller === true;
  if (stock !== undefined) updates.stock = Number(stock);
  if (newImages.length > 0) updates.images = [...product.images, ...newImages];

  const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('colors');
  res.json({ success: true, data: updated });
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  // Remove uploaded images (Cloudinary or legacy local disk)
  for (const img of product.images) {
    await deleteImage(img);
  }

  res.json({ success: true, message: 'Product deleted' });
};

export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return;
  }

  const newImages = (req.files as Express.Multer.File[] | undefined)?.map((f) => f.path) ?? [];

  if (newImages.length === 0) {
    res.status(400).json({ success: false, message: 'No images provided' });
    return;
  }

  product.images = [...product.images, ...newImages];
  await product.save();
  res.json({ success: true, data: product });
};
