import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

// Los tipos de multer-storage-cloudinary colapsan a `{}` cuando cloudinary
// define un index signature en UploadApiOptions — cast necesario, ver:
// https://github.com/affanshahid/multer-storage-cloudinary/issues (KnownKeys + index signature)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'macrochet',
    allowed_formats: ['jpeg', 'jpg', 'png', 'webp', 'gif'],
  } as any,
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif)'));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
