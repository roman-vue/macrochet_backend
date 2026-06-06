import { Request, Response, NextFunction } from 'express';

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
  if ((req.session as any).user) {
    next();
  } else {
    res.redirect('/login');
  }
}
