import { Router, Request, Response, NextFunction } from 'express';
import { createOrderSchema } from '../validation/order';
import { createOrder, OrderError } from '../services/orderService';
import { formatOrderNumber } from '../models/Order';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  try {
    const { order, whatsappMessage } = await createOrder(parsed.data);
    res.status(201).json({
      success: true,
      data: {
        number: formatOrderNumber(order.number),
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        whatsappMessage,
      },
    });
  } catch (err) {
    if (err instanceof OrderError) {
      res.status(err.status).json({ success: false, message: err.message, details: err.details });
      return;
    }
    next(err);
  }
});

export default router;
