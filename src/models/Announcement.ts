import { Schema, model, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  message: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    message: { type: String, required: [true, 'Message is required'], trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
