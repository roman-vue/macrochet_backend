import { Request, Response } from 'express';
import { Announcement } from '../models/Announcement';

export const getActiveAnnouncements = async (_req: Request, res: Response): Promise<void> => {
  const announcements = await Announcement.find({ status: true }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: announcements });
};

export const getAllAnnouncements = async (_req: Request, res: Response): Promise<void> => {
  const announcements = await Announcement.find().sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: announcements });
};

export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
  const { title, message, image, order, status } = req.body;

  if (!title || !message || !image) {
    res.status(400).json({ success: false, message: 'Title, message and image are required' });
    return;
  }

  const announcement = await Announcement.create({
    title,
    message,
    image,
    order: order !== undefined ? Number(order) : 0,
    status: status !== undefined ? Boolean(status) : true,
  });

  res.status(201).json({ success: true, data: announcement });
};

export const updateAnnouncement = async (req: Request, res: Response): Promise<void> => {
  const { title, message, image, order, status } = req.body;

  const announcement = await Announcement.findByIdAndUpdate(
    req.params.id,
    {
      ...(title && { title }),
      ...(message && { message }),
      ...(image && { image }),
      ...(order !== undefined && { order: Number(order) }),
      ...(status !== undefined && { status: Boolean(status) }),
    },
    { new: true, runValidators: true }
  );

  if (!announcement) {
    res.status(404).json({ success: false, message: 'Announcement not found' });
    return;
  }

  res.json({ success: true, data: announcement });
};

export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) {
    res.status(404).json({ success: false, message: 'Announcement not found' });
    return;
  }
  res.json({ success: true, message: 'Announcement deleted' });
};
