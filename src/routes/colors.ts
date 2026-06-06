import { Router } from 'express';
import { getColors, createColor, deleteColor } from '../controllers/colorController';

const router = Router();

router.get('/', getColors);
router.post('/', createColor);
router.delete('/:id', deleteColor);

export default router;
