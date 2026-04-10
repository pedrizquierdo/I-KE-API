import { Router } from 'express'
import {
  crearOrdenController,
  getOrdenesController,
  getOrdenByIdController,
  cambiarEstadoOrdenController,
  getOrdenesByUsuarioController,
  getOrdenesDeliveryController,
  editarItemsOrdenController,
} from './orders.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { CrearOrdenSchema, CambiarEstadoOrdenSchema, ActualizarItemsOrdenSchema } from '../../schemas'

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

// Cola de domicilios — repartidor y gerente
// IMPORTANTE: debe estar antes de '/:id' para que Express no lo interprete como un ID
router.get('/delivery',
  verificarToken,
  verificarRol('repartidor', 'gerente', 'cajero'),
  getOrdenesDeliveryController,
)

// Ver orden por ID — solo staff
router.get('/:id',
  verificarToken,
  verificarRol('gerente', 'cajero', 'cocinero', 'mesero'),
  getOrdenByIdController,
)

// Editar items (agregar / cambiar cantidad / eliminar) — gerente, cajero, mesero
router.patch('/:id/items',
  verificarToken,
  verificarRol('gerente', 'cajero', 'mesero'),
  validate(ActualizarItemsOrdenSchema),
  editarItemsOrdenController,
)

// Cambiar estado — solo staff de cocina/servicio
router.patch('/:id/status',
  verificarToken,
  verificarRol('gerente', 'cajero', 'cocinero', 'mesero'),
  validate(CambiarEstadoOrdenSchema),
  cambiarEstadoOrdenController,
)

export { router as ordersRoutes }