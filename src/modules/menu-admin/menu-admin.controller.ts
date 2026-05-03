import { Request, Response } from 'express'
import {
  getAllProductos, getAllCombos,
  crearProducto, actualizarProducto, eliminarProducto, subirImagenProducto,
  crearCategoria, actualizarCategoria,
  crearCombo, actualizarCombo, eliminarCombo,
} from './menu-admin.service'
import { AppError } from '../../lib/AppError'

// ─── Admin: todos los productos / combos (incluye inactivos) ─────────────────
export const getAllProductosController = async (_req: Request, res: Response) => {
  const productos = await getAllProductos()
  res.json(productos)
}

export const getAllCombosController = async (_req: Request, res: Response) => {
  const combos = await getAllCombos()
  res.json(combos)
}

// ─── Productos ────────────────────────────────────────────────────────────────
export const crearProductoController = async (req: Request, res: Response) => {
  const { categoriaId, nombre, descripcion, precioBase, imagenUrl } = req.body
  const producto = await crearProducto({ categoriaId, nombre, descripcion, precioBase, imagenUrl })
  res.status(201).json(producto)
}

export const actualizarProductoController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const producto = await actualizarProducto(id, req.body)
  res.json(producto)
}

export const subirImagenProductoController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  if (!req.file) throw new AppError(400, 'No se proporcionó ninguna imagen')
  const imagen_url = await subirImagenProducto(id, req.file.buffer)
  res.json({ imagen_url })
}

export const eliminarProductoController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const producto = await eliminarProducto(id)
  res.json(producto)
}

// ─── Categorías ───────────────────────────────────────────────────────────────
export const crearCategoriaController = async (req: Request, res: Response) => {
  const { nombre, descripcion } = req.body
  const categoria = await crearCategoria(nombre, descripcion)
  res.status(201).json(categoria)
}

export const actualizarCategoriaController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const categoria = await actualizarCategoria(id, req.body)
  res.json(categoria)
}

// ─── Combos ───────────────────────────────────────────────────────────────────
export const crearComboController = async (req: Request, res: Response) => {
  const { nombre, descripcion, precio, imagenUrl, items } = req.body
  const combo = await crearCombo({ nombre, descripcion, precio, imagenUrl, items })
  res.status(201).json(combo)
}

export const actualizarComboController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const combo = await actualizarCombo(id, req.body)
  res.json(combo)
}

export const eliminarComboController = async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string)
  if (isNaN(id)) throw new AppError(400, 'ID inválido')
  const combo = await eliminarCombo(id)
  res.json(combo)
}
