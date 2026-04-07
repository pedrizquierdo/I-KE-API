import rateLimit from 'express-rate-limit'

/**
 * Rate limiter para endpoints de autenticación.
 * Máximo 10 intentos por IP cada 15 minutos.
 * Protege contra brute force en login y refresh.
 */
export const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutos
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
  },
  // En producción, si hay un reverse proxy (Railway, Render, etc.)
  // descomenta la siguiente línea para leer la IP real:
  // trustProxy: true,
  skip: () => process.env.NODE_ENV === 'test',
})