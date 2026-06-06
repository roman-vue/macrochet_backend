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
  },
  { timestamps: true }
);

export const Product = model<IProduct>('Product', productSchema);
