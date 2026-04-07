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
import { validate } from '../../middlewares/validate.middleware'
import {
  CrearProductoSchema,
  ActualizarProductoSchema,
  CrearCategoriaSchema,
  ActualizarCategoriaSchema,
  CrearComboSchema,
  ActualizarComboSchema,
} from '../../schemas'

const router = Router()

const soloGerente = [verificarToken, verificarRol('gerente')]

// Categorías
router.post('/categorias',      ...soloGerente, validate(CrearCategoriaSchema),     crearCategoriaController)
router.patch('/categorias/:id', ...soloGerente, validate(ActualizarCategoriaSchema), actualizarCategoriaController)

// Productos
router.post('/productos',      ...soloGerente, validate(CrearProductoSchema),     crearProductoController)
router.patch('/productos/:id', ...soloGerente, validate(ActualizarProductoSchema), actualizarProductoController)
router.delete('/productos/:id',...soloGerente,                                     eliminarProductoController)

// Combos
router.post('/combos',      ...soloGerente, validate(CrearComboSchema),     crearComboController)
router.patch('/combos/:id', ...soloGerente, validate(ActualizarComboSchema), actualizarComboController)
router.delete('/combos/:id',...soloGerente,                                  eliminarComboController)

export { router as menuAdminRoutes }