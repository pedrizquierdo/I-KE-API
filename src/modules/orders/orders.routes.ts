import { Router } from 'express'
import {
  crearOrdenController,
  getOrdenesController,
  getOrdenByIdController,
  cambiarEstadoOrdenController,
  getOrdenesByUsuarioController,
} from './orders.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

// Crear orden — cualquier usuario autenticado
router.post('/', verificarToken, crearOrdenController)

// Ver órdenes — solo empleados
router.get('/', verificarToken, verificarRol('gerente', 'cajero', 'cocinero', 'repartidor'), getOrdenesController)

router.get('/my', verificarToken, getOrdenesByUsuarioController)

// Ver orden específica — cualquier autenticado
router.get('/:id', verificarToken, getOrdenByIdController)

// Cambiar estado — solo empleados
router.patch('/:id/status', verificarToken, verificarRol('gerente', 'cajero', 'cocinero', 'repartidor'), cambiarEstadoOrdenController)



export { router as ordersRoutes }