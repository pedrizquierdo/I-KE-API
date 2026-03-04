import { Router } from 'express'
import {
  getCategorias,
  getProductos,
  getProductoById,
  getProductosByCategoria,
  getCombos,
  getPromociones,
} from './menu.controller'

const router = Router()

// Categorías
router.get('/categorias', getCategorias)

// Productos
router.get('/productos', getProductos)
router.get('/productos/:id', getProductoById)
router.get('/categorias/:id/productos', getProductosByCategoria)

// Combos
router.get('/combos', getCombos)

// Promociones activas
router.get('/promociones', getPromociones)

export { router as menuRoutes }