import { Schema, model, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  images: string[];
  colors: Types.ObjectId[];
  category: string;
  isBestseller: boolean;
  stock: number;
  wholesalePrice?: number; // solo admin (select: false)
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    description: { type: String, required: [true, 'Description is required'], trim: true },
    price: { type: Number, required: [true, 'Price is required'], min: [0, 'Price must be positive'] },
    images: [{ type: String }],
    colors: [{ type: Schema.Types.ObjectId, ref: 'Color' }],
    category: { type: String, required: [true, 'Category is required'], trim: true },
    isBestseller: { type: Boolean, default: false },
    stock: { type: Number, default: 0, min: [0, 'Stock cannot be negative'] },
    // Precio mayorista: oculto por defecto para que el API público nunca lo exponga
    wholesalePrice: { type: Number, min: 0, select: false },
  },
  { timestamps: true }
);

export const Product = model<IProduct>('Product', productSchema);
