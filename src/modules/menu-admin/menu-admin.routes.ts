import { Router } from 'express'
import {
  crearProductoController,
  actualizarProductoController,
  eliminarProductoController,
  crearCategoriaController,
  actualizarCategoriaController,
  crearComboController,
  actualizarComboController,
  eliminarComboController,
} from './menu-admin.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'

const router = Router()

// Solo gerente puede gestionar el menú
const soloGerente = [verificarToken, verificarRol('gerente')]

// Productos
router.post('/products', ...soloGerente, crearProductoController)
router.patch('/products/:id', ...soloGerente, actualizarProductoController)
router.delete('/products/:id', ...soloGerente, eliminarProductoController)

// Categorías
router.post('/categories', ...soloGerente, crearCategoriaController)
router.patch('/categories/:id', ...soloGerente, actualizarCategoriaController)

// Combos
router.post('/combos', ...soloGerente, crearComboController)
router.patch('/combos/:id', ...soloGerente, actualizarComboController)
router.delete('/combos/:id', ...soloGerente, eliminarComboController)

export { router as menuAdminRoutes }