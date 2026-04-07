import { Request, Response } from 'express'
import {
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  crearCategoria,
  actualizarCategoria,
  crearCombo,
  actualizarCombo,
  eliminarCombo,
} from './menu-admin.service'

// ─── Productos ────────────────────────────────────────────────────────────────
export const crearProductoController = async (req: Request, res: Response) => {
  try {
    const { categoriaId, nombre, descripcion, precioBase, imagenUrl } = req.body
    if (!categoriaId || !nombre || !precioBase) {
      res.status(400).json({ error: 'categoriaId, nombre y precioBase son requeridos' })
      return
    }
    const producto = await crearProducto({ categoriaId, nombre, descripcion, precioBase, imagenUrl })
    res.status(201).json(producto)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear producto'
    res.status(400).json({ error: mensaje })
  }
}

export const actualizarProductoController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const producto = await actualizarProducto(id, req.body)
    res.json(producto)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar producto'
    res.status(400).json({ error: mensaje })
  }
}

export const eliminarProductoController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const producto = await eliminarProducto(id)
    res.json(producto)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al eliminar producto'
    res.status(400).json({ error: mensaje })
  }
}

// ─── Categorías ───────────────────────────────────────────────────────────────
export const crearCategoriaController = async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion } = req.body
    if (!nombre) { res.status(400).json({ error: 'nombre es requerido' }); return }
    const categoria = await crearCategoria(nombre, descripcion)
    res.status(201).json(categoria)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear categoría'
    res.status(400).json({ error: mensaje })
  }
}

export const actualizarCategoriaController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const categoria = await actualizarCategoria(id, req.body)
    res.json(categoria)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar categoría'
    res.status(400).json({ error: mensaje })
  }
}

// ─── Combos ───────────────────────────────────────────────────────────────────
export const crearComboController = async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, precio, imagenUrl, items } = req.body
    if (!nombre || !precio || !items || items.length === 0) {
      res.status(400).json({ error: 'nombre, precio e items son requeridos' })
      return
    }
    const combo = await crearCombo({ nombre, descripcion, precio, imagenUrl, items })
    res.status(201).json(combo)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al crear combo'
    res.status(400).json({ error: mensaje })
  }
}

export const actualizarComboController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const combo = await actualizarCombo(id, req.body)
    res.json(combo)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al actualizar combo'
    res.status(400).json({ error: mensaje })
  }
}

export const eliminarComboController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string)
    if (isNaN(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const combo = await eliminarCombo(id)
    res.json(combo)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al eliminar combo'
    res.status(400).json({ error: mensaje })
  }
}