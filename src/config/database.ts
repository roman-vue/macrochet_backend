import mongoose from 'mongoose';
import { logger } from '../middlewares/logger';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB;
  if (!uri) throw new Error('MONGODB env variable is not defined');

  try {
    await mongoose.connect(uri, { dbName: 'macrochet' });
    logger.info('MongoDB connected to macrochet database');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
