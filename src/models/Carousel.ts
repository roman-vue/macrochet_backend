import { Schema, model, Document } from 'mongoose';

export interface ICarousel extends Document {
  image: string;
  title: string;
  order: number;
  active: boolean;
  createdAt: Date;
}

const carouselSchema = new Schema<ICarousel>(
  {
    image: { type: String, required: true },
    title: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Carousel = model<ICarousel>('Carousel', carouselSchema);
