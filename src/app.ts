import './config/env' // Valida variables de entorno al arrancar — falla rápido si faltan
import express, { Request, Response, NextFunction } from 'express'
import http from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import { menuRoutes } from './modules/menu/menu.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { servicesRoutes } from './modules/services/services.routes'
import { ordersRoutes } from './modules/orders/orders.routes'
import { paymentsRoutes } from './modules/payments/payments.routes'
import { usersRoutes } from './modules/users/users.routes'
import { menuAdminRoutes } from './modules/menu-admin/menu-admin.routes'
import { inventoryRoutes } from './modules/inventory/inventory.routes'
import { reportsRoutes } from './modules/reports/reports.routes'
import { AppError } from './lib/AppError'
import { logger } from './lib/logger'
import { initSocket } from './lib/socket'

const app = express()
const httpServer = http.createServer(app)

const PORT = process.env.PORT || 3000

const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL ?? '',
].filter(Boolean) as string[]

app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }))

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/menu', menuRoutes)
app.use('/auth', authRoutes)
app.use('/services', servicesRoutes)
app.use('/orders', ordersRoutes)
app.use('/payments', paymentsRoutes)
app.use('/users', usersRoutes)
app.use('/admin/menu', menuAdminRoutes)
app.use('/inventory', inventoryRoutes)
app.use('/reports', reportsRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'I KE APP backend corriendo' })
})

// ─── Middleware de errores centralizado ───────────────────────────────────────
// Captura cualquier error lanzado en controllers/services. Evita filtrar
// detalles internos de Prisma u otras librerías al cliente.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, err.message)

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // Error inesperado — no exponer detalles internos al cliente
  res.status(500).json({ error: 'Error interno del servidor' })
})

// ─── Socket.io para notificaciones en tiempo real (pantalla de cocina) ────────
initSocket(httpServer, corsOrigins)

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`🌮 Servidor corriendo en http://localhost:${PORT}`)
})

export default app
