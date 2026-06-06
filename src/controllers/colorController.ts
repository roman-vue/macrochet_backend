import { Request, Response } from 'express';
import { Color } from '../models/Color';

export const getColors = async (_req: Request, res: Response): Promise<void> => {
  const colors = await Color.find().sort({ createdAt: -1 });
  res.json({ success: true, data: colors });
};

export const createColor = async (req: Request, res: Response): Promise<void> => {
  const { name, hex } = req.body;

  if (!name || !hex) {
    res.status(400).json({ success: false, message: 'Name and hex are required' });
    return;
  }

  const existing = await Color.findOne({ hex });
  if (existing) {
    res.status(409).json({ success: false, message: 'A color with this hex already exists' });
    return;
  }

  const color = await Color.create({ name, hex });
  res.status(201).json({ success: true, data: color });
};

export const deleteColor = async (req: Request, res: Response): Promise<void> => {
  const color = await Color.findByIdAndDelete(req.params.id);
  if (!color) {
    res.status(404).json({ success: false, message: 'Color not found' });
    return;
  }
  res.json({ success: true, message: 'Color deleted' });
};
