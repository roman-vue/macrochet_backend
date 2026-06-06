import { Request, Response } from 'express';
import { Product } from '../models/Product';

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  const categories = await Product.distinct('category');
  res.json({ success: true, data: categories.sort() });
};
