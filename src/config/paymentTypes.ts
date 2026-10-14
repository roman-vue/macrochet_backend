// Tipos de cuenta de pago. Para agregar otro (p. ej. Daviplata) basta con una entrada aquí.
export const PAYMENT_TYPES = {
  nequi: {
    label: 'Nequi',
    inMessage: 'Nequi',
    addLabel: 'Agregar Nequi',
    fields: [
      { key: 'number', label: 'Número de celular' },
      { key: 'holder', label: 'Titular' },
    ],
  },
  breb: {
    label: 'Bre-B',
    inMessage: 'Bre-B',
    addLabel: 'Agregar llave Bre-B',
    fields: [
      { key: 'key', label: 'Llave' },
      { key: 'holder', label: 'Titular' },
    ],
  },
  transfer: {
    label: 'Transferencia bancaria',
    inMessage: 'transferencia bancaria',
    addLabel: 'Agregar cuenta bancaria',
    fields: [
      { key: 'bank', label: 'Banco' },
      { key: 'accountType', label: 'Tipo de cuenta', options: ['Ahorros', 'Corriente'] },
      { key: 'accountNumber', label: 'Número de cuenta' },
      { key: 'holder', label: 'Titular' },
    ],
  },
} as const;

export type PaymentType = keyof typeof PAYMENT_TYPES;
export const PAYMENT_TYPE_IDS = Object.keys(PAYMENT_TYPES) as [PaymentType, ...PaymentType[]];
export const isPaymentType = (v: unknown): v is PaymentType => typeof v === 'string' && v in PAYMENT_TYPES;
