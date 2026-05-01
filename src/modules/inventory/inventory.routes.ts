import { Router } from 'express'
import {
  getIngredientesController,
  getAlertasStockController,
  crearIngredienteController,
  actualizarIngredienteController,
  desactivarIngredienteController,
  registrarMovimientoController,
  getMovimientosController,
  getUnidadesMedidaController,
  getRecetasByProductoController,
  crearRecetaController,
  actualizarRecetaController,
  eliminarRecetaController,
} from './inventory.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import {
  CrearIngredienteSchema,
  ActualizarIngredienteSchema,
  RegistrarMovimientoSchema,
  CrearRecetaSchema,
} from '../../schemas'

const router = Router()

const soloGerente  = [verificarToken, verificarRol('gerente')]
const staffCocina  = [verificarToken, verificarRol('gerente', 'cocinero')]

// Unidades de medida
router.get('/unidades', verificarToken, getUnidadesMedidaController)

// Ingredientes
router.get('/',           ...staffCocina, getIngredientesController)
router.get('/alertas',    ...staffCocina, getAlertasStockController)
router.post('/',          ...soloGerente, validate(CrearIngredienteSchema),      crearIngredienteController)
router.patch('/:id',      ...soloGerente, validate(ActualizarIngredienteSchema), actualizarIngredienteController)
router.delete('/:id',     ...soloGerente, desactivarIngredienteController)

// Movimientos
router.get('/movimientos',   ...staffCocina, getMovimientosController)
router.post('/movimientos',  ...staffCocina, validate(RegistrarMovimientoSchema), registrarMovimientoController)

// Recetas
router.get('/recetas/:id',                           ...staffCocina, getRecetasByProductoController)
router.post('/recetas',                              ...soloGerente, validate(CrearRecetaSchema), crearRecetaController)
router.patch('/recetas/:productoId/:ingredienteId',  ...soloGerente, actualizarRecetaController)
router.delete('/recetas/:productoId/:ingredienteId', ...soloGerente, eliminarRecetaController)

export { router as inventoryRoutes }