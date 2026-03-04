import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { menuRoutes } from './modules/menu/menu.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares
app.use(cors())
app.use(express.json())

// Rutas
app.use('/menu', menuRoutes)

// Ruta de salud — para verificar que el servidor está corriendo
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'I KE APP backend corriendo' })
})

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`🌮 Servidor corriendo en http://localhost:${PORT}`)
})

export default app