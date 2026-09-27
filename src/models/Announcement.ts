import { Schema, model, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  message: string;
  image: string;
  order: number;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    message: { type: String, required: [true, 'Message is required'], trim: true },
    image: { type: String, required: [true, 'Image is required'] },
    order: { type: Number, default: 0 },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
