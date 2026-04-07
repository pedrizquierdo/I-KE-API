import { Router } from 'express'
import {
  getIngredientesController,
  getAlertasStockController,
  crearIngredienteController,
  actualizarIngredienteController,
  registrarMovimientoController,
  getMovimientosController,
  getUnidadesMedidaController,
  getRecetasByProductoController,
  crearRecetaController,
} from './inventory.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

const soloAdmin = [verificarToken, verificarRol('gerente')]
const empleados = [verificarToken, verificarRol('gerente', 'cajero', 'cocinero')]

// Unidades de medida
router.get('/units', ...empleados, getUnidadesMedidaController)

// Ingredientes
router.get('/ingredients', ...empleados, getIngredientesController)
router.get('/ingredients/alerts', ...empleados, getAlertasStockController)
router.post('/ingredients', ...soloAdmin, crearIngredienteController)
router.patch('/ingredients/:id', ...soloAdmin, actualizarIngredienteController)

// Movimientos
router.get('/movements', ...soloAdmin, getMovimientosController)
router.post('/movements', ...soloAdmin, registrarMovimientoController)

// Recetas
router.get('/recipes/product/:id', ...soloAdmin, getRecetasByProductoController)
router.post('/recipes', ...soloAdmin, crearRecetaController)

export { router as inventoryRoutes }