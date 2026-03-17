import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'
import { menuRoutes } from './modules/menu/menu.routes'
import { authRoutes } from './modules/auth/auth.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true, // necesario para cookies
}))
app.use(express.json())
app.use(cookieParser()) // para leer cookies del refresh token

// Rutas
app.use('/menu', menuRoutes)
app.use('/auth', authRoutes)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'I KE APP backend corriendo' })
})

app.listen(PORT, () => {
  console.log(`🌮 Servidor corriendo en http://localhost:${PORT}`)
})

export default app