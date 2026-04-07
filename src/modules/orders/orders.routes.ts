import { Router } from 'express'
import {
  crearOrdenController,
  getOrdenesController,
  getOrdenByIdController,
  cambiarEstadoOrdenController,
  getOrdenesByUsuarioController,
} from './orders.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { CrearOrdenSchema, CambiarEstadoOrdenSchema } from '../../schemas'

const router = Router()

// Crear orden — cualquier usuario autenticado (o anónimo para pedidos de mostrador)
router.post('/',
  validate(CrearOrdenSchema),
  crearOrdenController,
)

// Ver todas las órdenes activas — solo staff
router.get('/',
  verificarToken,
  verificarRol('gerente', 'cajero', 'cocinero', 'mesero'),
  getOrdenesController,
)

// Ver mis pedidos — usuario autenticado
router.get('/mis-pedidos',
  verificarToken,
  getOrdenesByUsuarioController,
)

// Ver orden por ID — solo staff
router.get('/:id',
  verificarToken,
  verificarRol('gerente', 'cajero', 'cocinero', 'mesero'),
  getOrdenByIdController,
)

// Cambiar estado — solo staff de cocina/servicio
router.patch('/:id/status',
  verificarToken,
  verificarRol('gerente', 'cajero', 'cocinero', 'mesero'),
  validate(CambiarEstadoOrdenSchema),
  cambiarEstadoOrdenController,
)

export { router as ordersRoutes }