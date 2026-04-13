import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private helmet = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'sha256-9WwJgUUGp3FzV4RsZ7O2fSCp2LlVg6oYq0J1nIjJ3xc='",
        ], // Specific hash for Swagger styles
        scriptSrc: [
          "'self'",
          "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
        ], // Specific hash for required scripts
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' },
    crossOriginEmbedderPolicy: false, // Disable for API usage
    hsts:
      process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false, // Disable HSTS in development
  });

  use(req: Request, res: Response, next: NextFunction) {
    // Skip security headers for Swagger documentation routes
    if (req.path?.startsWith('/api/docs')) {
      return next();
    }

    this.helmet(req, res, next);
  }
}
