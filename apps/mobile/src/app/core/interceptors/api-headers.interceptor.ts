import { HttpInterceptorFn } from '@angular/common/http';

/**
 * API Headers Interceptor
 *
 * Adds required headers for Laravel API requests:
 * - X-Requested-With: XMLHttpRequest (identifies AJAX requests)
 * - Accept: application/json (ensures JSON responses)
 * - Content-Type: application/json (for POST/PUT requests)
 */
export const apiHeadersInterceptor: HttpInterceptorFn = (req, next) => {
  // Clone the request and add required headers
  const modifiedReq = req.clone({
    setHeaders: {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  return next(modifiedReq);
};
