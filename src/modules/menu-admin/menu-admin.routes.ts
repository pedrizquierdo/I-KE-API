import { Router } from 'express'
import {
  getAllProductosController,
  getAllCombosController,
  crearProductoController,
  actualizarProductoController,
  eliminarProductoController,
  subirImagenProductoController,
  crearCategoriaController,
  actualizarCategoriaController,
  crearComboController,
  actualizarComboController,
  eliminarComboController,
} from './menu-admin.controller'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { uploadImagen } from '../../middlewares/upload.middleware'
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

// Listados admin (incluyen inactivos)
router.get('/products',    ...soloGerente, getAllProductosController)
router.get('/combos-all',  ...soloGerente, getAllCombosController)

// Categorías
router.post('/categorias',      ...soloGerente, validate(CrearCategoriaSchema),     crearCategoriaController)
router.patch('/categorias/:id', ...soloGerente, validate(ActualizarCategoriaSchema), actualizarCategoriaController)

// Productos
router.post('/productos',            ...soloGerente, validate(CrearProductoSchema),     crearProductoController)
router.patch('/productos/:id',       ...soloGerente, validate(ActualizarProductoSchema), actualizarProductoController)
router.patch('/productos/:id/image', ...soloGerente, uploadImagen,                       subirImagenProductoController)
router.delete('/productos/:id',      ...soloGerente,                                     eliminarProductoController)

// Combos
router.post('/combos',      ...soloGerente, validate(CrearComboSchema),     crearComboController)
router.patch('/combos/:id', ...soloGerente, validate(ActualizarComboSchema), actualizarComboController)
router.delete('/combos/:id',...soloGerente,                                  eliminarComboController)

export { router as menuAdminRoutes }