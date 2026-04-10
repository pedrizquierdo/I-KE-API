import { prisma } from '../../config/db'
import { getServicioActivo } from '../services/services.service'
import { Decimal } from '@prisma/client/runtime/library'
import { AppError } from '../../lib/AppError'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProductoOrden {
  productoId: number
  cantidad: number
  notas?: string
}

interface ComboOrden {
  comboId: number
  cantidad: number
}

interface CrearOrdenDTO {
  productos?: ProductoOrden[]
  combos?: ComboOrden[]
  notas?: string
  nombreCliente?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
}

// ─── Helper: aritmética segura con Decimal ────────────────────────────────────
const toNum = (val: Decimal | string | number | null | undefined): number =>
  new Decimal(val?.toString() ?? '0').toNumber()

// ─── Crear orden ──────────────────────────────────────────────────────────────
export const crearOrden = async (datos: CrearOrdenDTO, usuarioId?: number) => {
  const servicio = await getServicioActivo()
  if (!servicio) throw new AppError(400, 'No hay ningún servicio abierto')

  const productosMap = new Map<number, { precio_base: Decimal; nombre: string }>()
  const combosMap    = new Map<number, { precio: Decimal; nombre: string }>()

  if (datos.productos && datos.productos.length > 0) {
    const ids = datos.productos.map((p) => p.productoId)
    const rows = await prisma.productos.findMany({
      where: { id: { in: ids }, disponible: true },
      select: { id: true, nombre: true, precio_base: true },
    })
    rows.forEach((r) => productosMap.set(r.id, r))
  }

  if (datos.combos && datos.combos.length > 0) {
    const ids = datos.combos.map((c) => c.comboId)
    const rows = await prisma.combos.findMany({
      where: { id: { in: ids }, disponible: true },
      select: { id: true, nombre: true, precio: true },
    })
    rows.forEach((r) => combosMap.set(r.id, r))
  }

  let subtotal = 0

  const detallesProductos = (datos.productos ?? []).map((item) => {
    const producto = productosMap.get(item.productoId)
    if (!producto) throw new AppError(400, `Producto ${item.productoId} no disponible`)
    subtotal += toNum(producto.precio_base) * item.cantidad
    return {
      producto_id: item.productoId,
      cantidad:    item.cantidad,
      precio_unitario: producto.precio_base,
      notas_item:  item.notas ?? null,
    }
  })

  const detallesCombos = (datos.combos ?? []).map((item) => {
    const combo = combosMap.get(item.comboId)
    if (!combo) throw new AppError(400, `Combo ${item.comboId} no disponible`)
    subtotal += toNum(combo.precio) * item.cantidad
    return {
      combo_id:        item.comboId,
      cantidad:        item.cantidad,
      precio_unitario: combo.precio,
    }
  })

  if (subtotal === 0) throw new AppError(400, 'La orden debe tener al menos un producto o combo')

  const [orden] = await prisma.$transaction([
    prisma.ordenes.create({
      data: {
        servicio_id:    servicio.id,
        usuario_id:     usuarioId ?? null,
        nombre_cliente: datos.nombreCliente ?? null,
        notas_orden:    datos.notas ?? null,
        subtotal,
        descuento: 0,
        estado: 'pendiente',
        orden_detalles: detallesProductos.length > 0 ? { create: detallesProductos } : undefined,
        orden_combos:   detallesCombos.length > 0   ? { create: detallesCombos }   : undefined,
      },
      include: {
        orden_detalles: {
          include: {
            productos: { select: { id: true, nombre: true, precio_base: true } },
          },
        },
        orden_combos: {
          include: {
            combos: { select: { id: true, nombre: true, precio: true } },
          },
        },
      },
    }),
  ])

  await prisma.orden_estados_historial.create({
    data: { orden_id: orden.id, estado: 'pendiente', notas: 'Orden creada' },
  })

  return orden
}

// ─── Obtener órdenes activas del servicio abierto ─────────────────────────────
export const getOrdenes = async (pagination?: PaginationParams) => {
  const page  = Math.max(1, pagination?.page ?? 1)
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50))
  const skip  = (page - 1) * limit

  const servicio = await getServicioActivo()
  const where = {
    estado: { not: 'cancelada' as const },
    ...(servicio ? { servicio_id: servicio.id } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.ordenes.findMany({
      where,
      include: {
        orden_detalles: {
          include: { productos: { select: { id: true, nombre: true } } },
        },
        orden_combos: {
          include: { combos: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { creado_en: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ordenes.count({ where }),
  ])

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
}

// ─── Obtener orden por ID ─────────────────────────────────────────────────────
export const getOrdenById = async (id: number) => {
  const orden = await prisma.ordenes.findUnique({
    where: { id },
    include: {
      orden_detalles: {
        include: {
          productos: { select: { id: true, nombre: true, precio_base: true } },
        },
      },
      orden_combos: {
        include: {
          combos: { select: { id: true, nombre: true, precio: true } },
        },
      },
      orden_estados_historial: { orderBy: { registrado_en: 'asc' } },
    },
  })

  if (!orden) throw new AppError(404, 'Orden no encontrada')
  return orden
}

// ─── Cambiar estado de la orden ───────────────────────────────────────────────
const TRANSICIONES: Record<string, string[]> = {
  pendiente:      ['en_preparacion', 'cancelada'],
  en_preparacion: ['lista', 'cancelada'],
  lista:          ['entregada', 'cancelada'],
  entregada:      [],
  cancelada:      [],
}

export const cambiarEstadoOrden = async (
  id: number,
  estado: string,
  empleadoId?: number
) => {
  const orden = await prisma.ordenes.findUnique({ where: { id } })
  if (!orden) throw new AppError(404, 'Orden no encontrada')

  const transicionesValidas = TRANSICIONES[orden.estado] ?? []
  if (!transicionesValidas.includes(estado)) {
    throw new AppError(
      422,
      `No se puede pasar de "${orden.estado}" a "${estado}". ` +
      `Transiciones válidas: ${transicionesValidas.join(', ') || 'ninguna'}`
    )
  }

  const [ordenActualizada] = await prisma.$transaction([
    prisma.ordenes.update({
      where: { id },
      data: { estado, actualizado_en: new Date() },
    }),
    prisma.orden_estados_historial.create({
      data: { orden_id: id, estado, empleado_id: empleadoId ?? null },
    }),
  ])

  return ordenActualizada
}

// ─── Órdenes por usuario ──────────────────────────────────────────────────────
export const getOrdenesByUsuario = async (usuarioId: number, pagination?: PaginationParams) => {
  const page  = Math.max(1, pagination?.page ?? 1)
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 20))
  const skip  = (page - 1) * limit

  const where = { usuario_id: usuarioId }

  const [items, total] = await Promise.all([
    prisma.ordenes.findMany({
      where,
      include: {
        orden_detalles: {
          include: {
            productos: { select: { id: true, nombre: true, precio_base: true } },
          },
        },
        orden_combos: {
          include: {
            combos: { select: { id: true, nombre: true, precio: true } },
          },
        },
      },
      orderBy: { creado_en: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ordenes.count({ where }),
  ])

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
}
