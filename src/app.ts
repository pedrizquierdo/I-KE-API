import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import { menuRoutes } from './modules/menu/menu.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { servicesRoutes } from './modules/services/services.routes'
import { ordersRoutes } from './modules/orders/orders.routes'
import { paymentsRoutes } from './modules/payments/payments.routes'
import { usersRoutes } from './modules/users/users.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser()) // para leer cookies del refresh token

// Rutas
app.use('/menu', menuRoutes)
app.use('/auth', authRoutes)
app.use('/services', servicesRoutes)
app.use('/orders', ordersRoutes)
app.use('/payments', paymentsRoutes)
app.use('/users', usersRoutes)


app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'I KE APP backend corriendo' })
})

app.listen(PORT, () => {
  console.log(`🌮 Servidor corriendo en http://localhost:${PORT}`)
})

export default app