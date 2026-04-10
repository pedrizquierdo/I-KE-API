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
  tipoServicio?: 'mostrador' | 'domicilio' | 'evento'
  productos?: ProductoOrden[]
  combos?: ComboOrden[]
  notas?: string
  nombreCliente?: string
  direccionEntrega?: string
  telefonoCliente?: string
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
        servicio_id:       servicio.id,
        usuario_id:        usuarioId ?? null,
        tipo_servicio:     datos.tipoServicio ?? 'mostrador',
        nombre_cliente:    datos.nombreCliente ?? null,
        notas_orden:       datos.notas ?? null,
        direccion_entrega: datos.direccionEntrega ?? null,
        telefono_cliente:  datos.telefonoCliente ?? null,
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

// ─── Actualizar tiempo estimado (solo cocinero) ───────────────────────────────
// Solo válido mientras la orden está activa (pendiente / en_preparacion).
// Pasar null limpia el estimado (p.ej. si el cocinero se equivocó).
export const actualizarTiempoEstimado = async (
  id: number,
  tiempoEstimadoMinutos: number | null,
) => {
  const orden = await prisma.ordenes.findUnique({ where: { id } })
  if (!orden) throw new AppError(404, 'Orden no encontrada')

  if (!['pendiente', 'en_preparacion'].includes(orden.estado)) {
    throw new AppError(
      422,
      `No se puede actualizar el tiempo estimado de una orden en estado "${orden.estado}". ` +
      'Solo se permite en "pendiente" o "en_preparacion".',
    )
  }

  await prisma.ordenes.update({
    where: { id },
    data:  { tiempo_estimado_minutos: tiempoEstimadoMinutos, actualizado_en: new Date() },
  })

  // Devuelve la vista completa para que el WebSocket la reenvíe a cocina y al cliente
  return getOrdenById(id)
}

// ─── Editar items de una orden ────────────────────────────────────────────────
interface EditarItemsOrdenDTO {
  productos?: { productoId: number; cantidad: number; notas?: string }[]
  combos?: { comboId: number; cantidad: number }[]
}

export const editarItemsOrden = async (
  ordenId: number,
  datos: EditarItemsOrdenDTO,
  empleadoId?: number,
) => {
  // ── 1. Cargar orden con sus items actuales ───────────────────────────────────
  const orden = await prisma.ordenes.findUnique({
    where: { id: ordenId },
    include: { orden_detalles: true, orden_combos: true },
  })
  if (!orden) throw new AppError(404, 'Orden no encontrada')

  if (!['pendiente', 'en_preparacion'].includes(orden.estado)) {
    throw new AppError(
      422,
      `No se pueden editar items de una orden en estado "${orden.estado}". ` +
      'Solo se permite en "pendiente" o "en_preparacion".',
    )
  }

  const esPendiente = orden.estado === 'pendiente'

  // ── 2. Separar operaciones por tipo ─────────────────────────────────────────
  const productosUpsert   = (datos.productos ?? []).filter(p => p.cantidad > 0)
  const productosEliminar = (datos.productos ?? []).filter(p => p.cantidad === 0)
  const combosUpsert      = (datos.combos ?? []).filter(c => c.cantidad > 0)
  const combosEliminar    = (datos.combos ?? []).filter(c => c.cantidad === 0)

  if (!esPendiente && (productosEliminar.length > 0 || combosEliminar.length > 0)) {
    throw new AppError(
      422,
      'La orden ya está en preparación: solo se pueden agregar items o cambiar cantidades, no eliminar.',
    )
  }

  // ── 3. Mapas de items existentes (clave: productoId / comboId) ───────────────
  // Si por algún edge-case hubiera duplicados en BD, el último gana (no debería ocurrir).
  const detallesMap = new Map(orden.orden_detalles.map(d => [d.producto_id, d]))
  const combosMap   = new Map(orden.orden_combos.map(c => [c.combo_id, c]))

  // ── 4. Obtener precios actuales solo para los items NUEVOS ───────────────────
  // Los items existentes conservan su precio_unitario congelado al crear la orden.
  const nuevosProductoIds = productosUpsert
    .filter(p => !detallesMap.has(p.productoId))
    .map(p => p.productoId)

  const productoPrecioMap = new Map<number, Decimal>()
  if (nuevosProductoIds.length > 0) {
    const rows = await prisma.productos.findMany({
      where: { id: { in: nuevosProductoIds }, disponible: true },
      select: { id: true, precio_base: true },
    })
    rows.forEach(r => productoPrecioMap.set(r.id, r.precio_base))
    for (const id of nuevosProductoIds) {
      if (!productoPrecioMap.has(id))
        throw new AppError(400, `Producto ${id} no existe o no está disponible`)
    }
  }

  const nuevosCombosIds = combosUpsert
    .filter(c => !combosMap.has(c.comboId))
    .map(c => c.comboId)

  const comboPrecioMap = new Map<number, Decimal>()
  if (nuevosCombosIds.length > 0) {
    const rows = await prisma.combos.findMany({
      where: { id: { in: nuevosCombosIds }, disponible: true },
      select: { id: true, precio: true },
    })
    rows.forEach(r => comboPrecioMap.set(r.id, r.precio))
    for (const id of nuevosCombosIds) {
      if (!comboPrecioMap.has(id))
        throw new AppError(400, `Combo ${id} no existe o no está disponible`)
    }
  }

  // ── 5. Transacción: mutaciones + recálculo de subtotal ───────────────────────
  await prisma.$transaction(async (tx) => {
    // Eliminar productos (solo en 'pendiente', ya validado arriba)
    for (const item of productosEliminar) {
      const d = detallesMap.get(item.productoId)
      if (!d) throw new AppError(400, `El producto ${item.productoId} no está en esta orden`)
      await tx.orden_detalles.delete({ where: { id: d.id } })
    }

    // Eliminar combos
    for (const item of combosEliminar) {
      const c = combosMap.get(item.comboId)
      if (!c) throw new AppError(400, `El combo ${item.comboId} no está en esta orden`)
      await tx.orden_combos.delete({ where: { id: c.id } })
    }

    // Upsert productos
    for (const item of productosUpsert) {
      const existente = detallesMap.get(item.productoId)
      if (existente) {
        // Actualizar cantidad y recalcular subtotal de la fila.
        // dbgenerated() solo aplica en INSERT — hay que computarlo manualmente en UPDATE.
        await tx.orden_detalles.update({
          where: { id: existente.id },
          data: {
            cantidad: item.cantidad,
            subtotal: new Decimal(item.cantidad).mul(existente.precio_unitario),
            ...(item.notas !== undefined ? { notas_item: item.notas } : {}),
          },
        })
      } else {
        // Nuevo item — la DB calcula subtotal vía DEFAULT dbgenerated
        await tx.orden_detalles.create({
          data: {
            orden_id:        ordenId,
            producto_id:     item.productoId,
            cantidad:        item.cantidad,
            precio_unitario: productoPrecioMap.get(item.productoId)!,
            notas_item:      item.notas ?? null,
          },
        })
      }
    }

    // Upsert combos
    for (const item of combosUpsert) {
      const existente = combosMap.get(item.comboId)
      if (existente) {
        await tx.orden_combos.update({
          where: { id: existente.id },
          data: {
            cantidad: item.cantidad,
            subtotal: new Decimal(item.cantidad).mul(existente.precio_unitario),
          },
        })
      } else {
        await tx.orden_combos.create({
          data: {
            orden_id:        ordenId,
            combo_id:        item.comboId,
            cantidad:        item.cantidad,
            precio_unitario: comboPrecioMap.get(item.comboId)!,
          },
        })
      }
    }

    // Verificar que la orden no quede vacía tras las eliminaciones
    const [detallesFinal, combosFinal] = await Promise.all([
      tx.orden_detalles.findMany({
        where:  { orden_id: ordenId },
        select: { precio_unitario: true, cantidad: true },
      }),
      tx.orden_combos.findMany({
        where:  { orden_id: ordenId },
        select: { precio_unitario: true, cantidad: true },
      }),
    ])

    if (detallesFinal.length === 0 && combosFinal.length === 0) {
      throw new AppError(422, 'La orden debe conservar al menos un producto o combo')
    }

    // Recalcular ordenes.subtotal (no es computed en BD — se almacena manualmente)
    const nuevoSubtotal =
      detallesFinal.reduce((sum, d) => sum + toNum(d.precio_unitario) * d.cantidad, 0) +
      combosFinal.reduce((sum, c)   => sum + toNum(c.precio_unitario) * c.cantidad, 0)

    await tx.ordenes.update({
      where: { id: ordenId },
      data:  { subtotal: nuevoSubtotal, actualizado_en: new Date() },
    })
  })

  // ── 6. Devolver la orden actualizada completa (incluye total recalculado) ────
  return getOrdenById(ordenId)
}

// ─── Órdenes de domicilio (vista del repartidor) ─────────────────────────────
// Muestra todas las órdenes de tipo 'domicilio' en estados activos.
// El repartidor ve la cola completa; la asignación individual se gestiona
// mediante PATCH /:id/status cuando toma una orden.
const ESTADOS_ACTIVOS_DELIVERY = ['pendiente', 'en_preparacion', 'lista']

export const getOrdenesDelivery = async (pagination?: PaginationParams) => {
  const page  = Math.max(1, pagination?.page ?? 1)
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50))
  const skip  = (page - 1) * limit

  const where = {
    tipo_servicio: 'domicilio',
    estado: { in: ESTADOS_ACTIVOS_DELIVERY },
  }

  const [items, total] = await Promise.all([
    prisma.ordenes.findMany({
      where,
      select: {
        id:                      true,
        numero:                  true,
        estado:                  true,
        nombre_cliente:          true,
        direccion_entrega:       true,
        telefono_cliente:        true,
        subtotal:                true,
        total:                   true,
        notas_orden:             true,
        tiempo_estimado_minutos: true,
        creado_en:               true,
        actualizado_en:          true,
        orden_detalles: {
          include: { productos: { select: { id: true, nombre: true } } },
        },
        orden_combos: {
          include: { combos: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { creado_en: 'asc' }, // más antiguas primero → prioridad de entrega
      skip,
      take: limit,
    }),
    prisma.ordenes.count({ where }),
  ])

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
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
