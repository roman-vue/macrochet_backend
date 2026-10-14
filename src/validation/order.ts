import { z } from 'zod';
import { PAYMENT_METHODS } from '../models/Order';

// Los precios NO vienen del cliente: se recalculan en el servidor.
export const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\+?[\d\s-]{7,20}$/, 'Teléfono inválido'),
    email: z.union([z.email().max(120), z.literal('')]).optional(),
    city: z.string().trim().min(2).max(60),
    address: z.string().trim().min(5).max(160),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f0-9]{24}$/i, 'Producto inválido'),
        qty: z.number().int().min(1).max(99),
        color: z.string().trim().max(40).optional(),
      })
    )
    .min(1, 'El carrito está vacío')
    .max(20),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
