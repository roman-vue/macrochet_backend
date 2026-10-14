import { z } from 'zod';

export const quoteInputSchema = z.object({
  client: z.object({
    name: z.string().trim().max(80).default(''),
    city: z.string().trim().max(60).default(''),
    phone: z.string().trim().max(20).default(''),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
        name: z.string().trim().min(1).max(120),
        price: z.number().min(0).max(100_000_000),
        listPrice: z.number().min(0).max(100_000_000).optional(),
        qty: z.number().int().min(1).max(999),
        image: z.string().url().max(500).optional(),
      })
    )
    .max(30),
  deliveryTime: z.string().trim().max(80).default(''),
  notes: z.string().trim().max(1000).default(''),
  shipping: z.number().min(0).max(10_000_000).default(0),
  wholesale: z.boolean().default(false),
  wholesaleDiscount: z.number().min(0).max(90).default(0),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;
