import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface CorsConfig {
  origins: string[];
}

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  constructor(private config?: CorsConfig) {}

  use(req: Request, res: Response, next: NextFunction) {
    const allowedOrigins = this.config?.origins ||
      process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
    );

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-Request-ID'
    );

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  }
}
