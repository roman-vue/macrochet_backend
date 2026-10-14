import { Schema, model, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  message: string;
  image: string;
  order: number;
  status: boolean;
  placement: 'anuncio' | 'carrusel';
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    // El carrusel del hero solo necesita imagen y título (alt)
    message: {
      type: String,
      trim: true,
      default: '',
      required: [function (this: IAnnouncement) { return this.placement !== 'carrusel'; }, 'Message is required'],
    },
    image: { type: String, required: [true, 'Image is required'] },
    order: { type: Number, default: 0 },
    status: { type: Boolean, default: true },
    placement: { type: String, enum: ['anuncio', 'carrusel'], default: 'anuncio' },
  },
  { timestamps: true }
);

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
