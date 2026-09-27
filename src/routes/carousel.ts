import { Router, Request, Response } from 'express';
import { Carousel } from '../models/Carousel';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const slides = await Carousel.find({ active: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data: slides });
});

export default router;
