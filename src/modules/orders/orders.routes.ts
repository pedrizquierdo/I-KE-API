import { Router } from 'express'
import {
  crearOrdenController,
  getOrdenesController,
  getOrdenByIdController,
  cambiarEstadoOrdenController,
  getOrdenesByUsuarioController,
  getOrdenesDeliveryController,
  editarItemsOrdenController,
  actualizarTiempoEstimadoController,
  asignarRepartidorController,
  getMyDeliveriesController,
} from './orders.controller'
import { verificarToken, verificarTokenOpcional, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { CrearOrdenSchema, CambiarEstadoOrdenSchema, ActualizarItemsOrdenSchema, ActualizarTiempoEstimadoSchema, AsignarRepartidorSchema } from '../../schemas'

const router = Router()

// Crear orden — acepta anónimos y autenticados; si hay token válido se vincula la orden al usuario
router.post('/',
  verificarTokenOpcional,
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

// Mis repartos — solo el repartidor autenticado ve los que tiene asignados
// IMPORTANTE: debe estar antes de '/:id'
router.get('/my-deliveries',
  verificarToken,
  verificarRol('repartidor', 'gerente'),
  getMyDeliveriesController,
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

// Tiempo estimado — cocinero y gerente pueden ajustarlo
router.patch('/:id/estimated-time',
  verificarToken,
  verificarRol('cocinero', 'gerente'),
  validate(ActualizarTiempoEstimadoSchema),
  actualizarTiempoEstimadoController,
)

// Asignar repartidor — gerente y cajero
router.patch('/:id/assign-delivery',
  verificarToken,
  verificarRol('gerente', 'cajero'),
  validate(AsignarRepartidorSchema),
  asignarRepartidorController,
)

// Cambiar estado — solo staff de cocina/servicio
router.patch('/:id/status',
  verificarToken,
  verificarRol('gerente', 'cajero', 'cocinero', 'mesero'),
  validate(CambiarEstadoOrdenSchema),
  cambiarEstadoOrdenController,
)

export { router as ordersRoutes }