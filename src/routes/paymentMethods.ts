import { Router, Request, Response, NextFunction } from 'express';
import { getPaymentSettings, activeAccounts } from '../models/PaymentSettings';
import { PAYMENT_TYPES, PAYMENT_TYPE_IDS } from '../config/paymentTypes';

const router = Router();

// Tipos con al menos una cuenta activa; cada uno con todas sus cuentas activas
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await getPaymentSettings();
    const data = PAYMENT_TYPE_IDS.flatMap((type) => {
      const accounts = activeAccounts(settings, type);
      if (accounts.length === 0) return [];
      return [{
        id: type,
        label: PAYMENT_TYPES[type].label,
        accounts: accounts.map((a) => ({
          id: String(a._id),
          fields: PAYMENT_TYPES[type].fields
            .map((f) => ({ label: f.label, value: a.fields.get(f.key) ?? '' }))
            .filter((f) => f.value.trim() !== ''),
        })),
      }];
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
