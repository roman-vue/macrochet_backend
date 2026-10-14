import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { requireLogin } from '../middlewares/sessionAuth';
import { Quote, IQuote, quoteStatus, quoteSubtotal, QUOTE_STATUSES } from '../models/Quote';
import { Product } from '../models/Product';
import { nextSequence } from '../models/Counter';
import { quoteInputSchema, QuoteInput } from '../validation/quote';
import { generateQuotePdf, saveQuotePdf, formatQuoteNumber, QuotePdfData } from '../services/quotePdf';
import { productPath } from '../utils/slug';

const router = Router();

function a(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const VALID_DAYS = 30;
const money = (n: number): string => `$${n.toLocaleString('es-CO')}`;
const STATUS_LABEL = { borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada', vencida: 'Vencida' };

function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `57${digits}` : digits;
}

function toPdfData(input: QuoteInput, meta: { number: number; date: Date; validUntil: Date; status: QuotePdfData['status'] }): QuotePdfData {
  return {
    ...meta,
    client: input.client,
    deliveryTime: input.deliveryTime,
    notes: input.notes,
    shipping: input.shipping,
    wholesale: input.wholesale,
    items: input.items.map((i) => ({
      ...i,
      productId: i.productId ? new Types.ObjectId(i.productId) : undefined,
      slugPath: i.productId ? productPath({ _id: i.productId, name: i.name }) : undefined,
    })),
  };
}

function quoteToInput(q: IQuote): QuoteInput {
  return {
    client: { name: q.client.name, city: q.client.city, phone: q.client.phone },
    items: q.items.map((i) => ({
      productId: i.productId ? String(i.productId) : undefined,
      name: i.name, price: i.price, listPrice: i.listPrice, qty: i.qty, image: i.image,
    })),
    deliveryTime: q.deliveryTime,
    notes: q.notes,
    shipping: q.shipping,
    wholesale: q.wholesale,
    wholesaleDiscount: q.wholesaleDiscount,
  };
}

async function renderAndStore(q: IQuote): Promise<Buffer> {
  const pdf = await generateQuotePdf(
    toPdfData(quoteToInput(q), { number: q.number, date: q.createdAt, validUntil: q.validUntil, status: quoteStatus(q) })
  );
  q.pdfUrl = await saveQuotePdf(q.token, pdf);
  await q.save();
  return pdf;
}

function parseBody(req: Request, res: Response): QuoteInput | null {
  const parsed = quoteInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') });
    return null;
  }
  return parsed.data;
}

// ── Listado ──────────────────────────────────────────────────────────────────

router.get('/admin/quotes', requireLogin, a(async (req, res) => {
  const quotes = await Quote.find().sort({ number: -1 }).limit(200);
  res.render('admin/quotes/index', {
    path: '/admin/quotes',
    quotes: quotes.map((q) => ({ q, status: quoteStatus(q), total: quoteSubtotal(q) + q.shipping })),
    STATUS_LABEL, money, formatQuoteNumber,
    success: req.query.success ?? null,
  });
}));

// ── Constructor ──────────────────────────────────────────────────────────────

async function renderBuilder(res: Response, quote: IQuote | null): Promise<void> {
  const products = await Product.find({}, 'name price images stock +wholesalePrice').sort({ name: 1 }).lean();
  res.render('admin/quotes/builder', {
    path: '/admin/quotes',
    quote: quote
      ? { id: String(quote._id), number: formatQuoteNumber(quote.number), status: quoteStatus(quote), ...quoteToInput(quote) }
      : null,
    catalog: products.map((p) => ({ id: String(p._id), name: p.name, price: p.price, wholesalePrice: p.wholesalePrice ?? null, image: p.images[0] ?? null })),
    statuses: QUOTE_STATUSES,
  });
}

router.get('/admin/quotes/new', requireLogin, a(async (_req, res) => renderBuilder(res, null)));

router.get('/admin/quotes/:id/edit', requireLogin, a(async (req, res) => {
  const quote = Types.ObjectId.isValid(req.params.id) ? await Quote.findById(req.params.id) : null;
  if (!quote) return res.redirect('/admin/quotes');
  await renderBuilder(res, quote);
}));

// Vista previa en vivo: genera el PDF sin guardar nada
router.post('/admin/quotes/preview', requireLogin, a(async (req, res) => {
  const input = parseBody(req, res);
  if (!input) return;
  const existing = typeof req.query.id === 'string' && Types.ObjectId.isValid(req.query.id) ? await Quote.findById(req.query.id) : null;
  const now = new Date();
  const pdf = await generateQuotePdf(toPdfData(input, {
    number: existing?.number ?? 0,
    date: existing?.createdAt ?? now,
    validUntil: existing?.validUntil ?? new Date(now.getTime() + VALID_DAYS * 864e5),
    status: existing ? quoteStatus(existing) : 'borrador',
  }));
  res.type('application/pdf').send(pdf);
}));

// Guardar (crear o actualizar)
router.post('/admin/quotes', requireLogin, a(async (req, res) => {
  const input = parseBody(req, res);
  if (!input) return;
  const id = typeof req.query.id === 'string' && Types.ObjectId.isValid(req.query.id) ? req.query.id : null;
  let quote = id ? await Quote.findById(id) : null;
  const data = { ...input, items: input.items.map((i) => ({ ...i, productId: i.productId ? new Types.ObjectId(i.productId) : undefined })) };
  if (quote) {
    quote.set(data);
    await quote.save();
  } else {
    quote = await Quote.create({
      ...data,
      number: await nextSequence('quote'),
      token: crypto.randomBytes(16).toString('hex'),
      validUntil: new Date(Date.now() + VALID_DAYS * 864e5),
    });
  }
  res.json({ success: true, data: { id: String(quote._id), number: formatQuoteNumber(quote.number) } });
}));

// Enviar por WhatsApp: genera y guarda el PDF, marca "enviada"
router.post('/admin/quotes/:id/send', requireLogin, a(async (req, res) => {
  const quote = Types.ObjectId.isValid(req.params.id) ? await Quote.findById(req.params.id) : null;
  if (!quote) {
    res.status(404).json({ success: false, message: 'Cotización no encontrada' });
    return;
  }
  if (quote.status === 'borrador') quote.status = 'enviada';
  await renderAndStore(quote);
  const pdfUrl = quote.pdfUrl as string;
  const n = formatQuoteNumber(quote.number);
  const name = quote.client.name.split(' ')[0];
  const text = `Hola${name ? ` ${name}` : ''}, te compartimos la cotización N.º ${n} de Macrochet 🧶\n\n${pdfUrl}\n\nEs válida hasta el ${quote.validUntil.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}. Cualquier duda, nos escribes por aquí.`;
  const phone = waPhone(quote.client.phone);
  res.json({
    success: true,
    data: {
      pdfUrl,
      filename: `Cotizacion-Macrochet-${n}.pdf`,
      text,
      waUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
    },
  });
}));

router.get('/admin/quotes/:id/pdf', requireLogin, a(async (req, res) => {
  const quote = Types.ObjectId.isValid(req.params.id) ? await Quote.findById(req.params.id) : null;
  if (!quote) return res.redirect('/admin/quotes');
  const pdf = await renderAndStore(quote);
  res.setHeader('Content-Disposition', `attachment; filename="Cotizacion-Macrochet-${formatQuoteNumber(quote.number)}.pdf"`);
  res.type('application/pdf').send(pdf);
}));

router.post('/admin/quotes/:id/approve', requireLogin, a(async (req, res) => {
  const quote = Types.ObjectId.isValid(req.params.id) ? await Quote.findById(req.params.id) : null;
  if (quote) {
    quote.status = 'aprobada';
    await renderAndStore(quote); // el sello del PDF pasa a APROBADA
  }
  res.redirect('/admin/quotes?success=' + encodeURIComponent(`Cotización N.º ${quote ? formatQuoteNumber(quote.number) : ''} aprobada.`));
}));

export default router;
