import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

// Código estable con el que la API marca el 401 cuando el access token ha caducado.
// Es el criterio del refresco: no depende de la redacción del mensaje.
const TOKEN_EXPIRED = 'TOKEN_EXPIRED';

// RESPALDO TEMPORAL: mensaje con el que respondía la API antes de tener `code`.
// Se puede borrar (esta constante y la rama de isTokenExpired que la usa) cuando el
// backend que envía `code` esté en producción y no queden clientes contra el antiguo.
const TOKEN_EXPIRED_MESSAGE = 'El token ha caducado';

// ¿El 401 dice que el access token ha caducado? Manda el `code`; el texto solo cuenta
// mientras el cuerpo no traiga `code` alguno (despliegue escalonado del backend).
// Un `code` distinto (TOKEN_MISSING, TOKEN_INVALID, SESSION_REVOKED...) nunca renueva.
function isTokenExpired(body: unknown): boolean {
  const payload = body as { code?: unknown; message?: unknown } | null;
  if (typeof payload?.code === 'string') {
    return payload.code === TOKEN_EXPIRED;
  }
  return payload?.message === TOKEN_EXPIRED_MESSAGE;
}

// Las peticiones son inmutables: para añadir una cabecera se hace una copia con clone()
function withToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

// Un interceptor se ejecuta en TODAS las peticiones de HttpClient, entre el servicio y la red.
// Este hace dos cosas, para que ningún servicio tenga que preocuparse del token:
//   1. Añade la cabecera Authorization: Bearer <token>.
//   2. Si la API responde 401 porque el token ha caducado, pide uno nuevo con el refresh token
//      y repite la petición. Si no se puede renovar, cierra la sesión (lleva al login).
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  // Las rutas de /auth no llevan token: login y register son públicas y refresh manda el suyo
  // en el body. Además, así un 401 del login (contraseña mala) no cierra ninguna sesión.
  if (request.url.startsWith(`${environment.apiUrl}/auth/`)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const token = auth.getToken();

  return next(token ? withToken(request, token) : request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Cualquier error que no sea 401 lo dejo pasar tal cual al componente
      if (error.status !== 401) {
        return throwError(() => error);
      }

      // 401 porque el token ha caducado: lo renuevo y repito la petición original una vez
      if (isTokenExpired(error.error)) {
        return auth.refresh().pipe(
          // Si el refresh falla (el refresh token también ha caducado), cierro la sesión
          catchError((refreshError) => {
            auth.logout();
            return throwError(() => refreshError);
          }),
          // switchMap: cuando llega el token nuevo, lanzo otra vez la petición con él
          switchMap((newToken) => next(withToken(request, newToken))),
        );
      }

      // Cualquier otro 401 (sin token, token falso...) quiere decir que no hay sesión válida
      auth.logout();
      return throwError(() => error);
    }),
  );
};
