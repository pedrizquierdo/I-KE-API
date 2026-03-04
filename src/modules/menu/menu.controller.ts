import { Request, Response } from 'express'
import {
  fetchCategorias,
  fetchProductos,
  fetchProductoById,
  fetchProductosByCategoria,
  fetchCombos,
  fetchPromociones,
} from './menu.service'

export const getCategorias = async (_req: Request, res: Response) => {
  try {
    const categorias = await fetchCategorias()
    res.json(categorias)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' })
  }
}

export const getProductos = async (_req: Request, res: Response) => {
  try {
    const productos = await fetchProductos()
    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' })
  }
}

export const getProductoById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    const producto = await fetchProductoById(id)

    if (!producto) {
      res.status(404).json({ error: 'Producto no encontrado' })
      return
    }

    res.json(producto)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' })
  }
}

export const getProductosByCategoria = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' })
      return
    }

    const productos = await fetchProductosByCategoria(id)
    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos por categoría' })
  }
}

export const getCombos = async (_req: Request, res: Response) => {
  try {
    const combos = await fetchCombos()
    res.json(combos)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener combos' })
  }
}

export const getPromociones = async (_req: Request, res: Response) => {
  try {
    const promociones = await fetchPromociones()
    res.json(promociones)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener promociones' })
  }
}