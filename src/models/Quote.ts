import { Schema, model, Document, Types } from 'mongoose';

export const QUOTE_STATUSES = ['borrador', 'enviada', 'aprobada', 'vencida'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface IQuoteItem {
  productId?: Types.ObjectId;
  name: string;
  price: number; // precio final de la línea
  listPrice?: number; // precio normal (se muestra tachado si es mayor)
  qty: number;
  image?: string;
}

export interface IQuote extends Document {
  number: number;
  token: string; // nombre del PDF público, no adivinable
  client: { name: string; city: string; phone: string };
  items: IQuoteItem[];
  deliveryTime: string;
  notes: string;
  shipping: number;
  wholesale: boolean;
  wholesaleDiscount: number; // % general si el producto no tiene precio mayorista
  status: Exclude<QuoteStatus, 'vencida'>;
  validUntil: Date;
  pdfUrl?: string; // Cloudinary (raw)
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>(
  {
    number: { type: Number, required: true, unique: true },
    token: { type: String, required: true, unique: true },
    client: {
      name: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
    },
    items: [
      {
        _id: false,
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        listPrice: { type: Number, min: 0 },
        qty: { type: Number, required: true, min: 1 },
        image: { type: String },
      },
    ],
    deliveryTime: { type: String, default: '8 días hábiles', trim: true },
    notes: { type: String, default: '', trim: true },
    shipping: { type: Number, default: 0, min: 0 },
    wholesale: { type: Boolean, default: false },
    wholesaleDiscount: { type: Number, default: 0, min: 0, max: 90 },
    status: { type: String, enum: ['borrador', 'enviada', 'aprobada'], default: 'borrador' },
    validUntil: { type: Date, required: true },
    pdfUrl: { type: String },
  },
  { timestamps: true }
);

export const Quote = model<IQuote>('Quote', quoteSchema);

// "vencida" no se guarda: se deriva de validUntil
export function quoteStatus(q: Pick<IQuote, 'status' | 'validUntil'>, now = new Date()): QuoteStatus {
  if (q.status !== 'aprobada' && q.validUntil < now) return 'vencida';
  return q.status;
}

export const quoteSubtotal = (q: Pick<IQuote, 'items'>): number =>
  q.items.reduce((s, i) => s + i.price * i.qty, 0);
