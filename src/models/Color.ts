import { Schema, model, Document } from 'mongoose';

export interface IColor extends Document {
  name: string;
  hex: string;
  createdAt: Date;
}

const colorSchema = new Schema<IColor>(
  {
    name: { type: String, required: [true, 'Color name is required'], trim: true },
    hex: {
      type: String,
      required: [true, 'Hex code is required'],
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color format'],
      unique: true,
    },
  },
  { timestamps: true }
);

export const Color = model<IColor>('Color', colorSchema);
