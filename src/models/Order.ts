import { Schema, model, Document, Types } from 'mongoose';

export const ORDER_STATUSES = ['esperando_comprobante', 'en_elaboracion', 'enviado', 'entregado'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

import { PAYMENT_TYPE_IDS, PaymentType } from '../config/paymentTypes';

export const PAYMENT_METHODS = PAYMENT_TYPE_IDS;
export type PaymentMethod = PaymentType;

export interface IOrderItem {
  productId: Types.ObjectId;
  name: string;
  price: number;
  qty: number;
  color?: string;
}

export interface IOrder extends Document {
  number: number;
  customer: { name: string; phone: string; email?: string; city: string; address: string };
  items: IOrderItem[];
  subtotal: number;
  shipping: number | null; // null = "se calcula por ciudad"
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  stockDiscounted: boolean;
  statusHistory: { status: OrderStatus; at: Date; note?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    number: { type: Number, required: true, unique: true },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },
    items: [
      {
        _id: false,
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        qty: { type: Number, required: true, min: 1 },
        color: { type: String, trim: true },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, default: null },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'esperando_comprobante' },
    stockDiscounted: { type: Boolean, default: false },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: ORDER_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);

export const formatOrderNumber = (n: number): string => String(n).padStart(4, '0');
