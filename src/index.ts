import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import { connectDB } from './config/database';
import { requestLogger, logger } from './middlewares/logger';
import productRoutes from './routes/products';
import colorRoutes from './routes/colors';
import announcementRoutes from './routes/announcements';
import categoryRoutes from './routes/categories';
import carouselRoutes from './routes/carousel';
import adminRoutes from './routes/adminRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
// En dev __dirname = src/, en producción (dist/) subimos un nivel para llegar a src/views
app.set('views', path.join(__dirname, '..', 'src', 'views'));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'macrochet-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 },
}));

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Request/response logger middleware
app.use(requestLogger);

// Admin panel (EJS views)
app.use('/', adminRoutes);

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/carousel', carouselRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Macrochet API running on port ${PORT}`);
  });
};

start();
