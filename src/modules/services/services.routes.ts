import { Router } from 'express'
import {
  abrirServicioController,
  cerrarServicioController,
  getServicioActivoController,
} from './services.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

// Obtener servicio activo — cualquier autenticado puede consultarlo
router.get('/active', verificarToken, getServicioActivoController)

// Abrir y cerrar — solo gerente o cajero
router.post('/open', verificarToken, verificarRol('gerente', 'cajero'), abrirServicioController)
router.post('/close', verificarToken, verificarRol('gerente', 'cajero'), cerrarServicioController)

export { router as servicesRoutes }