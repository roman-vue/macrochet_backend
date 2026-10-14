import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { BUSINESS } from '../config/business';
import { IQuoteItem, QuoteStatus } from '../models/Quote';
import { logger } from '../middlewares/logger';
import cloudinary from '../config/cloudinary';

const ASSETS = path.join(process.cwd(), 'assets');

const C = {
  cream: '#F0E5CF', panel: '#DFDAC2', border: '#C6CCAE', ink: '#4A3A2A', ink2: '#6B5F4B',
  wine: '#794848', sage: '#A1B391', green: '#537661', row: '#E6DCC8',
};

export interface QuotePdfData {
  number: number;
  date: Date;
  validUntil: Date;
  status: QuoteStatus;
  client: { name: string; city: string; phone: string };
  items: (IQuoteItem & { slugPath?: string })[];
  deliveryTime: string;
  notes: string;
  shipping: number;
  wholesale?: boolean;
}

const money = (n: number): string => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d: Date): string =>
  d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota' });
export const formatQuoteNumber = (n: number): string => String(n).padStart(4, '0');

// Miniatura de Cloudinary como JPG (pdfkit solo admite JPG/PNG)
async function fetchThumb(url?: string): Promise<Buffer | null> {
  if (!url || !url.includes('/upload/')) return null;
  try {
    const r = await fetch(url.replace('/upload/', '/upload/w_120,h_120,c_fill,f_jpg,q_80/'), {
      signal: AbortSignal.timeout(4000),
    });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch (err) {
    logger.warn(`Cotización: no se pudo descargar la miniatura ${url}`);
    return null;
  }
}

// Franja de punto de crochet: filas de "V" entrelazadas (vectorial)
function crochetBand(doc: PDFKit.PDFDocument, y: number, width: number): void {
  doc.save().strokeColor(C.sage).strokeOpacity(0.3).lineWidth(1.1).lineJoin('round');
  for (let row = 0; row < 2; row++) {
    const top = y + row * 7;
    const offset = row % 2 === 0 ? 0 : 5;
    for (let x = -10 + offset; x < width + 10; x += 10) {
      doc.moveTo(x, top).lineTo(x + 5, top + 8).lineTo(x + 10, top).stroke();
    }
  }
  doc.restore();
}

// Etiqueta tipo tag de tejido (con ojal y cordón)
function tag(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
  const notch = 18;
  doc.save();
  // cordón
  doc.moveTo(x + 9, y + h / 2).bezierCurveTo(x - 14, y + h / 2 - 22, x - 6, y - 10, x + 30, y - 8)
    .strokeColor(C.wine).lineWidth(1.2).stroke();
  doc.moveTo(x + notch, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x + notch, y + h)
    .lineTo(x, y + h / 2).closePath().fillAndStroke(C.panel, C.border);
  doc.circle(x + 12, y + h / 2, 3.5).fillAndStroke(C.cream, C.wine);
  // costura punteada
  doc.moveTo(x + notch + 4, y + 4).lineTo(x + w - 4, y + 4).lineTo(x + w - 4, y + h - 4).lineTo(x + notch + 4, y + h - 4)
    .lineTo(x + 5, y + h / 2).closePath().dash(2, { space: 2 }).strokeColor(C.sage).lineWidth(0.6).stroke().undash();
  doc.restore();
}

function stamp(doc: PDFKit.PDFDocument, x: number, y: number, status: QuoteStatus): void {
  const label = status === 'aprobada' ? 'APROBADA' : status === 'vencida' ? 'VENCIDA' : 'PENDIENTE';
  const color = status === 'aprobada' ? C.green : status === 'vencida' ? C.wine : '#7E8C70';
  doc.save().rotate(-7, { origin: [x + 55, y + 14] });
  doc.font('LatoBold').fontSize(15);
  const w = doc.widthOfString(label, { characterSpacing: 2 }) + 24;
  doc.roundedRect(x, y, w, 28, 4).lineWidth(2.5).strokeColor(color).strokeOpacity(0.85).stroke();
  doc.fillColor(color).fillOpacity(0.85).text(label, x + 12, y + 7, { characterSpacing: 2, lineBreak: false });
  doc.restore();
}

export async function generateQuotePdf(q: QuotePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0, info: { Title: `Cotización ${formatQuoteNumber(q.number)} — Macrochet`, Author: 'MACROCHET Artesanal' } });
  doc.registerFont('Playfair', path.join(ASSETS, 'fonts/playfair-display-latin-700-normal.ttf'));
  doc.registerFont('PlayfairItalic', path.join(ASSETS, 'fonts/playfair-display-latin-400-italic.ttf'));
  doc.registerFont('Lato', path.join(ASSETS, 'fonts/lato-latin-400-normal.ttf'));
  doc.registerFont('LatoBold', path.join(ASSETS, 'fonts/lato-latin-700-normal.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width; // 612
  const H = doc.page.height; // 792
  const M = 44;
  const logo = path.join(ASSETS, 'logo.jpg');
  const thumbs = await Promise.all(q.items.map((i) => fetchThumb(i.image)));
  const single = q.items.length === 1 && q.items[0].slugPath;
  const qr = await QRCode.toBuffer(single ? `${BUSINESS.site}${q.items[0].slugPath}` : `https://wa.me/${BUSINESS.whatsapp}`, {
    margin: 0, width: 220, color: { dark: C.ink, light: C.cream },
  });

  const paintBackground = () => {
    doc.rect(0, 0, W, H).fill(C.cream);
    crochetBand(doc, 6, W);
    crochetBand(doc, H - 22, W);
    doc.save().opacity(0.05).image(logo, W / 2 - 170, H / 2 - 170, { width: 340 }).restore();
  };
  paintBackground();

  // ── Encabezado ──
  const top = 40;
  doc.save().circle(M + 32, top + 32, 32).clip().rect(M, top, 64, 64).fill('#FFFFFF')
    .image(logo, M - 14, top - 14, { width: 92 }).restore();
  doc.circle(M + 32, top + 32, 32).lineWidth(1.5).strokeColor(C.wine).stroke();
  doc.fillColor(C.ink).font('Playfair').fontSize(26).text('MACROCHET', M + 78, top + 4, { lineBreak: false });
  doc.fillColor(C.wine).font('PlayfairItalic').fontSize(16).text('Artesanal', M + 78, top + 32, { lineBreak: false });
  doc.fillColor(C.ink2).font('Lato').fontSize(8.5)
    .text(`WhatsApp ${BUSINESS.whatsappLabel}  ·  Instagram ${BUSINESS.instagram}  ·  macrochet.com`, M + 78, top + 54, { lineBreak: false });

  const tx = W - M - 168;
  tag(doc, tx, top - 2, 168, 82);
  doc.fillColor(C.green).font('LatoBold').fontSize(7.5).text('COTIZACIÓN', tx + 26, top + 8, { characterSpacing: 2.2, lineBreak: false });
  doc.fillColor(C.ink).font('Playfair').fontSize(22).text(`N.º ${formatQuoteNumber(q.number)}`, tx + 26, top + 19, { lineBreak: false });
  doc.fillColor(C.ink2).font('Lato').fontSize(8)
    .text(`Fecha: ${fmtDate(q.date)}`, tx + 26, top + 50, { lineBreak: false })
    .text(`Válida hasta: ${fmtDate(q.validUntil)}`, tx + 26, top + 62, { lineBreak: false });

  let y = top + 96;
  doc.rect(M, y, W - 2 * M, 3).fill(C.wine);
  y += 18;

  // ── Cliente y condiciones ──
  const label = (t: string, x: number, yy: number) =>
    doc.fillColor(C.green).font('LatoBold').fontSize(7.5).text(t.toUpperCase(), x, yy, { characterSpacing: 1.8, lineBreak: false });
  label('Cliente', M, y);
  doc.fillColor(C.ink).font('LatoBold').fontSize(12).text((q.client.name || '—').toUpperCase(), M, y + 14, { width: 200 });
  doc.fillColor(C.ink2).font('Lato').fontSize(9)
    .text(q.client.city || '', M, doc.y + 2, { width: 200 })
    .text(q.client.phone ? `Tel: ${q.client.phone}` : '', M, doc.y + 1, { width: 200 });

  const cx = M + 190;
  label('Condiciones de la oferta', cx, y);
  const cond = (k: string, v: string, yy: number) => {
    doc.fillColor(C.ink2).font('Lato').fontSize(9).text(`${k}: `, cx, yy, { continued: true, width: 220 })
      .fillColor(C.ink).font('LatoBold').text(v);
  };
  cond('Tiempo de elaboración', q.deliveryTime || 'Por definir', y + 14);
  cond('Pago', 'Anticipado por Bre-B o transferencia', doc.y + 2);
  cond('Envíos', 'A toda Colombia', doc.y + 2);
  stamp(doc, W - M - 124, y + 20, q.status);
  y += 78;

  // ── Tabla ──
  const cols = { prod: M, qty: M + 300, unit: M + 350, total: W - M };
  doc.roundedRect(M, y, W - 2 * M, 24, 6).fill(C.ink);
  doc.fillColor(C.cream).font('LatoBold').fontSize(7.5);
  doc.text('PRODUCTO', cols.prod + 12, y + 9, { characterSpacing: 1.5, lineBreak: false });
  if (q.wholesale) {
    // Etiqueta "PRECIO MAYORISTA" dentro del encabezado de la tabla
    doc.roundedRect(cols.prod + 92, y + 5.5, 108, 13, 6.5).fill(C.sage);
    doc.fillColor(C.ink).font('LatoBold').fontSize(6.5).text('PRECIO MAYORISTA', cols.prod + 92, y + 9.3, { width: 108, align: 'center', characterSpacing: 1.2 });
    doc.fillColor(C.cream).font('LatoBold').fontSize(7.5);
  }
  doc.text('CANT.', cols.qty - 10, y + 9, { width: 40, align: 'center', characterSpacing: 1.5 });
  doc.text('VR. UNITARIO', cols.unit, y + 9, { width: 80, align: 'right', characterSpacing: 1.5 });
  doc.text('VR. TOTAL', cols.total - 92, y + 9, { width: 80, align: 'right', characterSpacing: 1.5 });
  y += 24;

  const rowH = 46;
  q.items.forEach((item, i) => {
    if (y + rowH > H - 230) {
      doc.addPage();
      paintBackground();
      y = 50;
    }
    const thumb = thumbs[i];
    if (thumb) {
      doc.save().roundedRect(cols.prod + 10, y + 6, 34, 34, 5).clip().image(thumb, cols.prod + 10, y + 6, { width: 34, height: 34 }).restore();
    } else {
      doc.roundedRect(cols.prod + 10, y + 6, 34, 34, 5).fill(C.panel);
    }
    doc.fillColor(C.ink).font('Playfair').fontSize(10.5).text(item.name, cols.prod + 54, y + 10, { width: 230, lineBreak: false, ellipsis: true });
    doc.fillColor(C.ink2).font('Lato').fontSize(7.5).text('Tejido a mano', cols.prod + 54, y + 26, { lineBreak: false });
    doc.fillColor(C.ink).font('Lato').fontSize(9.5).text(String(item.qty), cols.qty - 10, y + 18, { width: 40, align: 'center' });
    if (item.listPrice && item.listPrice > item.price) {
      // Precio normal tachado y debajo el mayorista
      const list = money(item.listPrice);
      doc.fillColor(C.ink2).font('Lato').fontSize(8).text(list, cols.unit, y + 11, { width: 80, align: 'right' });
      const lw = doc.widthOfString(list);
      doc.moveTo(cols.unit + 80 - lw, y + 15.5).lineTo(cols.unit + 80, y + 15.5).lineWidth(0.7).strokeColor(C.ink2).stroke();
      doc.fillColor(C.wine).font('LatoBold').fontSize(9.5).text(money(item.price), cols.unit, y + 23, { width: 80, align: 'right' });
    } else {
      doc.fillColor(C.ink).font('Lato').fontSize(9.5).text(money(item.price), cols.unit, y + 18, { width: 80, align: 'right' });
    }
    doc.fillColor(C.ink);
    doc.font('LatoBold').text(money(item.price * item.qty), cols.total - 92, y + 18, { width: 80, align: 'right' });
    y += rowH;
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(C.border).stroke();
  });

  const subtotal = q.items.reduce((s, i) => s + i.price * i.qty, 0);
  const sumRow = (k: string, v: string) => {
    doc.fillColor(C.ink2).font('Lato').fontSize(9).text(k, cols.unit - 60, y + 8, { width: 140, align: 'right' });
    doc.fillColor(C.ink).text(v, cols.total - 92, y + 8, { width: 80, align: 'right' });
    y += 18;
  };
  sumRow('Subtotal', money(subtotal));
  sumRow('Envío', q.shipping > 0 ? money(q.shipping) : 'Por calcular');
  const savings = q.items.reduce((s, i) => s + Math.max(0, (i.listPrice ?? i.price) - i.price) * i.qty, 0);
  if (savings > 0) {
    doc.fillColor(C.green).font('LatoBold').fontSize(9).text('Ahorro mayorista', cols.unit - 60, y + 8, { width: 140, align: 'right' });
    doc.text(`−${money(savings)}`, cols.total - 92, y + 8, { width: 80, align: 'right' });
    y += 18;
  }
  y += 8;

  // Caja de total
  const boxW = 230;
  doc.roundedRect(W - M - boxW, y, boxW, 44, 8).fill(C.ink);
  doc.fillColor(C.cream).font('LatoBold').fontSize(8).text('TOTAL', W - M - boxW + 18, y + 18, { characterSpacing: 2, lineBreak: false });
  doc.font('Playfair').fontSize(20).text(money(subtotal + q.shipping), W - M - boxW, y + 11, { width: boxW - 18, align: 'right' });

  // Observaciones (a la izquierda de la caja de total)
  label('Observaciones', M, y);
  doc.fillColor(C.ink2).font('Lato').fontSize(8.5).text(q.notes || '—', M, y + 13, { width: W - 2 * M - boxW - 24, lineGap: 1.5 });
  y = Math.max(y + 60, doc.y + 14);

  // ── Cómo funciona + QR ──
  const howH = 92;
  const howW = W - 2 * M - 110;
  doc.roundedRect(M, y, howW, howH, 10).lineWidth(1).fillAndStroke('#F6EFDD', C.border);
  doc.fillColor(C.ink).font('Playfair').fontSize(12).text('Cómo funciona tu pedido', M + 16, y + 12, { lineBreak: false });
  const steps = ['Aprueba la cotización', 'Paga y envía la captura por WhatsApp', 'Empezamos a tejer'];
  const stepW = (howW - 32) / 3;
  steps.forEach((s, i) => {
    const sx = M + 16 + i * stepW;
    doc.circle(sx + 9, y + 43, 9).fill(C.wine);
    doc.fillColor(C.cream).font('LatoBold').fontSize(9).text(String(i + 1), sx, y + 39, { width: 18, align: 'center' });
    doc.fillColor(C.ink).font('Lato').fontSize(8.5).text(s, sx + 24, y + 36, { width: stepW - 30 });
  });
  doc.fillColor(C.wine).font('LatoBold').fontSize(9).text('Sin el comprobante de pago no iniciamos el tejido.', M + 16, y + 70, { lineBreak: false });

  const qx = W - M - 92;
  doc.image(qr, qx + 10, y + 2, { width: 72 });
  doc.fillColor(C.ink2).font('Lato').fontSize(7).text(single ? 'Ver el producto' : 'Escríbenos por WhatsApp', qx - 4, y + 78, { width: 100, align: 'center' });
  y += howH + 18;

  // ── Pie ──
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(C.row).stroke();
  doc.fillColor(C.ink).font('LatoBold').fontSize(10).text('Gracias por su preferencia.', M, y + 12, { lineBreak: false });
  doc.fillColor(C.wine).font('PlayfairItalic').fontSize(9.5).text('Cada pieza es única y se teje a mano, a tu medida.', M, y + 27, { lineBreak: false });
  doc.moveTo(W - M - 150, y + 30).lineTo(W - M, y + 30).lineWidth(1.5).strokeColor(C.ink).stroke();
  doc.fillColor(C.ink2).font('Lato').fontSize(8).text('Elaborado por MACROCHET', W - M - 150, y + 35, { width: 150, align: 'center' });

  doc.end();
  return done;
}

// Sube el PDF a Cloudinary (enlace público que WhatsApp puede abrir, no depende del disco del VPS).
// Mismo public_id (token) → se sobrescribe y el enlace no cambia. Requiere "Allow delivery of PDF" en Cloudinary.
export async function saveQuotePdf(token: string, pdf: Buffer): Promise<string> {
  // data URI en vez de upload_stream: con este SDK el stream se quedaba sin respuesta (timeout)
  const result = await cloudinary.uploader.upload(`data:application/pdf;base64,${pdf.toString('base64')}`, {
    resource_type: 'raw',
    folder: 'macrochet/cotizaciones',
    public_id: `${token}.pdf`,
    overwrite: true,
    invalidate: true,
    timeout: 60000,
  });
  return result.secure_url;
}
