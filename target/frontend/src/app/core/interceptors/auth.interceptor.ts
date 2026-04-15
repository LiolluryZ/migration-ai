import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * JWT interceptor — attaches Authorization: Bearer <token> to every API request.
 *
 * Source: TM-auth (tech_mapping.json): session/cookie → JWT Bearer token.
 * BR-005: token validated by fastify.authenticate preHandler on protected routes.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authReq);
  }

  return next(req);
};
