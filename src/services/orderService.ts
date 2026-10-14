import mongoose, { Types } from 'mongoose';
import { Product } from '../models/Product';
import { Order, IOrder, OrderStatus } from '../models/Order';
import { nextSequence } from '../models/Counter';
import { getPaymentSettings, activeAccounts } from '../models/PaymentSettings';
import { CreateOrderInput } from '../validation/order';
import { buildOrderMessage } from './whatsappMessage';

export class OrderError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

// manual: pedido creado desde el admin (permite métodos de pago inactivos)
export async function createOrder(
  input: CreateOrderInput,
  { manual = false }: { manual?: boolean } = {}
): Promise<{ order: IOrder; whatsappMessage: string }> {
  const settings = await getPaymentSettings();
  if (!manual && activeAccounts(settings, input.paymentMethod).length === 0) {
    throw new OrderError(400, 'Método de pago no disponible');
  }

  // Agrupa líneas repetidas (mismo producto y color); el stock se valida por producto
  const lines = new Map<string, { productId: string; color?: string; qty: number }>();
  const qtyById = new Map<string, number>();
  for (const { productId, qty, color } of input.items) {
    const key = `${productId}|${color ?? ''}`;
    const line = lines.get(key) ?? { productId, color: color || undefined, qty: 0 };
    line.qty += qty;
    lines.set(key, line);
    qtyById.set(productId, (qtyById.get(productId) ?? 0) + qty);
  }

  const products = await Product.find({ _id: { $in: [...qtyById.keys()] } }, 'name price stock').lean();
  const problems: { productId: string; name?: string; reason: string; stock?: number }[] = [];
  for (const [productId, qty] of qtyById) {
    const p = products.find((x) => String(x._id) === productId);
    if (!p) problems.push({ productId, reason: 'no_existe' });
    else if (p.stock <= 0) problems.push({ productId, name: p.name, reason: 'agotado', stock: 0 });
    else if (qty > p.stock) problems.push({ productId, name: p.name, reason: 'stock_insuficiente', stock: p.stock });
  }
  const items = [...lines.values()].flatMap(({ productId, color, qty }) => {
    const p = products.find((x) => String(x._id) === productId);
    return p ? [{ productId: new Types.ObjectId(productId), name: p.name, price: p.price, qty, color }] : [];
  });
  if (problems.length > 0) {
    throw new OrderError(409, 'Algunos productos no están disponibles en la cantidad pedida', problems);
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const order = await Order.create({
    number: await nextSequence('order'),
    customer: { ...input.customer, email: input.customer.email || undefined },
    items,
    subtotal,
    shipping: null,
    total: subtotal,
    paymentMethod: input.paymentMethod,
    status: 'esperando_comprobante',
    statusHistory: [{ status: 'esperando_comprobante', note: manual ? 'Pedido manual' : undefined }],
  });

  return { order, whatsappMessage: buildOrderMessage(order) };
}

// Comprobante recibido → En elaboración. Descuenta stock una sola vez, todo o nada.
export async function confirmPayment(orderId: string): Promise<IOrder> {
  const session = await mongoose.startSession();
  try {
    let result: IOrder | null = null;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new OrderError(404, 'Pedido no encontrado');
      if (order.status !== 'esperando_comprobante') {
        throw new OrderError(409, 'El pedido ya fue confirmado');
      }

      if (!order.stockDiscounted) {
        const missing: string[] = [];
        for (const item of order.items) {
          const r = await Product.updateOne(
            { _id: item.productId, stock: { $gte: item.qty } },
            { $inc: { stock: -item.qty } },
            { session }
          );
          if (r.modifiedCount === 0) missing.push(item.name);
        }
        if (missing.length > 0) {
          // Lanzar aborta la transacción: no se descuenta nada
          throw new OrderError(409, `Sin stock suficiente para: ${missing.join(', ')}`, missing);
        }
        order.stockDiscounted = true;
      }

      order.status = 'en_elaboracion';
      order.statusHistory.push({ status: 'en_elaboracion', at: new Date() });
      result = await order.save({ session });
    });
    return result as unknown as IOrder;
  } finally {
    await session.endSession();
  }
}

// Avances posteriores: en_elaboracion → enviado → entregado
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { en_elaboracion: 'enviado', enviado: 'entregado' };

export async function advanceStatus(orderId: string, note?: string): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderError(404, 'Pedido no encontrado');
  if (order.status === 'esperando_comprobante') return confirmPayment(orderId);
  const next = NEXT[order.status];
  if (!next) throw new OrderError(409, 'El pedido ya fue entregado');
  order.status = next;
  order.statusHistory.push({ status: next, at: new Date(), note });
  return order.save();
}
