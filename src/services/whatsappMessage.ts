import { IOrder, formatOrderNumber } from '../models/Order';
import { BUSINESS } from '../config/business';
import { productPath } from '../utils/slug';
import { PAYMENT_TYPES } from '../config/paymentTypes';

// Solo construye el texto: wa.me no admite adjuntos, el cliente adjunta la captura a mano.
// El enlace al 1.er producto va PRIMERO: WhatsApp arma la vista previa con su foto (og:image).
const money = (n: number): string => `$${n.toLocaleString('es-CO')}`;


export function buildOrderMessage(order: Pick<IOrder, 'number' | 'items' | 'total' | 'shipping' | 'paymentMethod' | 'customer'>): string {
  const c = order.customer;
  const total = order.shipping === null ? `${money(order.total)} + envío` : money(order.total);
  const first = order.items[0];
  return [
    ...(first ? [`${BUSINESS.site}${productPath({ _id: first.productId, name: first.name })}`, ''] : []),
    `Hola Macrochet, quiero confirmar mi pedido #${formatOrderNumber(order.number)}.`,
    '',
    'Productos:',
    ...order.items.map((i) => `- ${i.qty} × ${i.name}${i.color ? ` (color ${i.color})` : ''}`),
    '',
    'Mis datos:',
    `👤 ${c.name}`,
    `📱 ${c.phone}`,
    ...(c.email ? [`✉️ ${c.email}`] : []),
    `📍 ${c.address}, ${c.city}`,
    '',
    `Total: ${total}`,
    `Pago por ${PAYMENT_TYPES[order.paymentMethod].inMessage}.`,
    '',
    'Adjunto la captura del pago. Entiendo que sin el comprobante no empiezan a tejer mi pedido.',
  ].join('\n');
}
