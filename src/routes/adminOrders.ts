import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { requireLogin } from '../middlewares/sessionAuth';
import { Order, ORDER_STATUSES, OrderStatus, IOrder, formatOrderNumber } from '../models/Order';
import { Product } from '../models/Product';
import { getPaymentSettings } from '../models/PaymentSettings';
import { PAYMENT_TYPES, PAYMENT_TYPE_IDS, isPaymentType } from '../config/paymentTypes';
import { createOrderSchema } from '../validation/order';
import { createOrder, advanceStatus, OrderError } from '../services/orderService';

const router = Router();

function a(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  esperando_comprobante: 'Esperando comprobante',
  en_elaboracion: 'En elaboración',
  enviado: 'Enviado',
  entregado: 'Entregado',
};

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  esperando_comprobante: 'Confirmar comprobante',
  en_elaboracion: 'Marcar como enviado',
  enviado: 'Marcar como entregado',
};

const money = (n: number): string => `$${n.toLocaleString('es-CO')}`;
const shortDate = (d: Date): string =>
  d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const dateTime = (d: Date): string =>
  d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

// wa.me necesita el número con indicativo: 300 123 4567 → 573001234567
function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `57${digits}` : digits;
}

// Aviso al cliente según el estado actual del pedido (botón "Avisar al cliente")
function customerMessage(order: IOrder): string {
  const n = formatOrderNumber(order.number);
  const name = order.customer.name.split(' ')[0];
  switch (order.status) {
    case 'esperando_comprobante':
      return `Hola ${name} 👋 Te escribimos de Macrochet por tu pedido #${n}. Para empezar a tejerlo, ¿nos compartes la captura del pago? 🧶`;
    case 'en_elaboracion':
      return `Hola ${name} 🧶 Recibimos tu comprobante. Tu pedido #${n} ya está en elaboración; te avisamos cuando lo enviemos.`;
    case 'enviado':
      return `Hola ${name} 📦 Tu pedido #${n} ya va en camino. ¡Gracias por tu compra!`;
    default:
      return `Hola ${name} 💛 ¿Te llegó bien tu pedido #${n}? Nos encantaría saber qué te pareció. ¡Gracias por elegir Macrochet!`;
  }
}

// Contador del sidebar en todas las páginas del admin
router.use('/admin', a(async (_req, res, next) => {
  res.locals.pendingOrders = await Order.countDocuments({ status: 'esperando_comprobante' });
  next();
}));

// ── Pedidos ──────────────────────────────────────────────────────────────────

router.get('/admin/orders', requireLogin, a(async (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status as OrderStatus) ? (req.query.status as OrderStatus) : null;
  const [orders, counts] = await Promise.all([
    Order.find(status ? { status } : {}).sort({ number: -1 }).limit(200),
    Order.aggregate<{ _id: OrderStatus; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const kpis = Object.fromEntries(ORDER_STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.n ?? 0]));

  const id = typeof req.query.id === 'string' && Types.ObjectId.isValid(req.query.id) ? req.query.id : null;
  const selected = id ? await Order.findById(id) : orders[0] ?? null;

  res.render('admin/orders/index', {
    path: '/admin/orders',
    orders, kpis, status, selected,
    statuses: ORDER_STATUSES, STATUS_LABEL, ACTION_LABEL, PAYMENT_TYPES,
    money, shortDate, dateTime, formatOrderNumber,
    waLink: selected
      ? `https://wa.me/${waPhone(selected.customer.phone)}?text=${encodeURIComponent(customerMessage(selected))}`
      : null,
    error: req.query.error ?? null,
    success: req.query.success ?? null,
  });
}));

router.post('/admin/orders/:id/advance', requireLogin, a(async (req, res) => {
  const back = (q: string) => res.redirect(`/admin/orders?id=${req.params.id}&${q}`);
  try {
    const order = await advanceStatus(req.params.id);
    back(`success=${encodeURIComponent(`Pedido #${formatOrderNumber(order.number)}: ${STATUS_LABEL[order.status]}`)}`);
  } catch (err) {
    if (err instanceof OrderError) return back(`error=${encodeURIComponent(err.message)}`);
    throw err;
  }
}));

// "Exportar a Excel": CSV con BOM y ; (Excel en español lo abre directo)
router.get('/admin/orders/export.csv', requireLogin, a(async (_req, res) => {
  const orders = await Order.find().sort({ number: -1 });
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Pedido', 'Fecha', 'Cliente', 'Celular', 'Email', 'Ciudad', 'Dirección', 'Productos', 'Subtotal', 'Envío', 'Total', 'Pago', 'Estado'],
    ...orders.map((o) => [
      formatOrderNumber(o.number), o.createdAt.toISOString().slice(0, 10), o.customer.name, o.customer.phone,
      o.customer.email, o.customer.city, o.customer.address, o.items.map((i) => `${i.qty} x ${i.name}${i.color ? ` (${i.color})` : ''}`).join(' | '),
      o.subtotal, o.shipping ?? '', o.total, PAYMENT_TYPES[o.paymentMethod]?.label ?? o.paymentMethod, STATUS_LABEL[o.status],
    ]),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n'));
}));

router.get('/admin/orders/new', requireLogin, a(async (_req, res) => {
  const products = await Product.find({}, 'name price stock').sort({ name: 1 });
  res.render('admin/orders/new', { path: '/admin/orders', products, money, error: null, values: {}, PAYMENT_TYPES, PAYMENT_TYPE_IDS });
}));

router.post('/admin/orders', requireLogin, a(async (req, res) => {
  const body = req.body as Record<string, string | string[]>;
  const ids = ([] as string[]).concat(body.productId ?? []);
  const qtys = ([] as string[]).concat(body.qty ?? []);
  const input = {
    customer: { name: body.name, phone: body.phone, email: body.email, city: body.city, address: body.address },
    items: ids.map((productId, i) => ({ productId, qty: parseInt(qtys[i] ?? '0', 10) })).filter((i) => i.productId && i.qty > 0),
    paymentMethod: body.paymentMethod,
  };

  const renderError = async (error: string) => {
    const products = await Product.find({}, 'name price stock').sort({ name: 1 });
    res.status(400).render('admin/orders/new', { path: '/admin/orders', products, money, error, values: body, PAYMENT_TYPES, PAYMENT_TYPE_IDS });
  };

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return renderError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
  }
  try {
    const { order } = await createOrder(parsed.data, { manual: true });
    res.redirect(`/admin/orders?id=${order._id}&success=${encodeURIComponent(`Pedido #${formatOrderNumber(order.number)} creado`)}`);
  } catch (err) {
    if (err instanceof OrderError) {
      const details = Array.isArray(err.details)
        ? err.details.map((d: { name?: string; stock?: number }) => `${d.name ?? 'Producto'} (stock ${d.stock ?? 0})`).join(', ')
        : '';
      return renderError(`${err.message}${details ? `: ${details}` : ''}`);
    }
    throw err;
  }
}));

// ── Inventario ───────────────────────────────────────────────────────────────

router.get('/admin/inventory', requireLogin, a(async (req, res) => {
  const products = await Product.find({}, 'name images stock price category').sort({ stock: 1, name: 1 });
  res.render('admin/inventory', { path: '/admin/inventory', products, money, success: req.query.success ?? null });
}));

router.post('/admin/inventory', requireLogin, a(async (req, res) => {
  const stock = (req.body.stock ?? {}) as Record<string, string>;
  const ops = Object.entries(stock)
    .filter(([id]) => Types.ObjectId.isValid(id))
    .map(([id, v]) => ({
      updateOne: { filter: { _id: id }, update: { $set: { stock: Math.max(0, parseInt(v, 10) || 0) } } },
    }));
  if (ops.length > 0) await Product.bulkWrite(ops);
  res.redirect('/admin/inventory?success=' + encodeURIComponent('Inventario actualizado.'));
}));

// ── Métodos de pago ──────────────────────────────────────────────────────────

router.get('/admin/payment-methods', requireLogin, a(async (req, res) => {
  const settings = await getPaymentSettings();
  res.render('admin/payment-methods', {
    path: '/admin/payment-methods', success: req.query.success ?? null, PAYMENT_TYPES, PAYMENT_TYPE_IDS,
    accounts: settings.accounts.map((acc) => ({ type: acc.type, active: acc.active, fields: Object.fromEntries(acc.fields) })),
  });
}));

// Body: accounts[i][type], accounts[i][active], accounts[i][fields][<clave>]
router.post('/admin/payment-methods', requireLogin, a(async (req, res) => {
  const raw = (req.body.accounts ?? {}) as Record<string, { type?: string; active?: string; fields?: Record<string, string> }>;
  const accounts = Object.values(raw).flatMap((acc) => {
    if (!isPaymentType(acc.type)) return [];
    const fields = Object.fromEntries(
      PAYMENT_TYPES[acc.type].fields.map((f) => [f.key, String(acc.fields?.[f.key] ?? '').trim().slice(0, 120)])
    );
    if (Object.values(fields).every((v) => v === '')) return []; // tarjetas vacías no se guardan
    return [{ type: acc.type, active: acc.active === 'on', fields }];
  });
  const settings = await getPaymentSettings();
  settings.set('accounts', accounts);
  await settings.save();
  res.redirect('/admin/payment-methods?success=' + encodeURIComponent('Métodos de pago guardados.'));
}));

export default router;
