import { Schema, model, Document, Types } from 'mongoose';
import { PAYMENT_TYPE_IDS, PaymentType } from '../config/paymentTypes';

// Documento único con una lista abierta de cuentas (varias por tipo).
export interface IPaymentAccount {
  _id: Types.ObjectId;
  type: PaymentType;
  active: boolean;
  fields: Map<string, string>;
}

export interface IPaymentSettings extends Document {
  accounts: Types.DocumentArray<IPaymentAccount & Types.Subdocument>;
  // Formato anterior (solo para migrar)
  breb?: { key?: string; holder?: string; active?: boolean };
  transfer?: { bank?: string; accountType?: string; accountNumber?: string; holder?: string; active?: boolean };
}

const accountSchema = new Schema<IPaymentAccount>({
  type: { type: String, enum: PAYMENT_TYPE_IDS, required: true },
  active: { type: Boolean, default: true },
  fields: { type: Map, of: String, default: {} },
});

const paymentSettingsSchema = new Schema<IPaymentSettings>(
  {
    accounts: { type: [accountSchema], default: [] },
    breb: { type: Schema.Types.Mixed },
    transfer: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const PaymentSettings = model<IPaymentSettings>('PaymentSettings', paymentSettingsSchema);

const hasData = (o: Record<string, unknown> | undefined): boolean =>
  !!o && Object.entries(o).some(([k, v]) => k !== 'active' && typeof v === 'string' && v.trim() !== '');

export async function getPaymentSettings(): Promise<IPaymentSettings> {
  const settings = (await PaymentSettings.findOne()) ?? (await PaymentSettings.create({}));

  // Migración del formato anterior (breb / transfer fijos) a la lista de cuentas
  if (settings.breb !== undefined || settings.transfer !== undefined) {
    const { breb, transfer } = settings;
    if (settings.accounts.length === 0) {
      if (hasData(breb)) {
        settings.accounts.push({ type: 'breb', active: !!breb?.active, fields: { key: breb?.key ?? '', holder: breb?.holder ?? '' } });
      }
      if (hasData(transfer)) {
        settings.accounts.push({
          type: 'transfer',
          active: !!transfer?.active,
          fields: {
            bank: transfer?.bank ?? '', accountType: transfer?.accountType ?? '',
            accountNumber: transfer?.accountNumber ?? '', holder: transfer?.holder ?? '',
          },
        });
      }
    }
    settings.breb = undefined;
    settings.transfer = undefined;
    await settings.save();
  }
  return settings;
}

export const activeAccounts = (s: IPaymentSettings, type?: PaymentType) =>
  s.accounts.filter((a) => a.active && (!type || a.type === type));
