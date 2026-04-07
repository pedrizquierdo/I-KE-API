import { prisma } from '../../config/db'
import { getServicioActivo } from '../services/services.service'
import { Decimal } from '@prisma/client/runtime/library'

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

// ─── Helper: aritmética segura con Decimal ────────────────────────────────────
const toNum = (val: Decimal | string | number | null | undefined): number =>
  new Decimal(val?.toString() ?? '0').toNumber()

// ─── Crear orden ──────────────────────────────────────────────────────────────
export const crearOrden = async (datos: CrearOrdenDTO, usuarioId?: number) => {
  // 1. Verificar servicio activo
  const servicio = await getServicioActivo()
  if (!servicio) {
    throw new Error('No hay ningún servicio abierto')
  }

  // 2. Obtener productos y combos en UNA sola query cada uno
  //    y construir maps para acceso O(1) — sin N+1
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

  // 3. Calcular subtotal y construir detalles usando los maps (sin queries extra)
  let subtotal = 0

  const detallesProductos = (datos.productos ?? []).map((item) => {
    const producto = productosMap.get(item.productoId)
    if (!producto) throw new Error(`Producto ${item.productoId} no disponible`)
    const precio = toNum(producto.precio_base)
    subtotal += precio * item.cantidad
    return {
      producto_id: item.productoId,
      cantidad:    item.cantidad,
      precio_unitario: producto.precio_base,
      notas_item:  item.notas ?? null,
    }
  })

  const detallesCombos = (datos.combos ?? []).map((item) => {
    const combo = combosMap.get(item.comboId)
    if (!combo) throw new Error(`Combo ${item.comboId} no disponible`)
    const precio = toNum(combo.precio)
    subtotal += precio * item.cantidad
    return {
      combo_id:        item.comboId,
      cantidad:        item.cantidad,
      precio_unitario: combo.precio,
    }
  })

  if (subtotal === 0) {
    throw new Error('La orden debe tener al menos un producto o combo')
  }

  // 4. Crear orden + detalles + historial en una sola transacción
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
        orden_detalles: detallesProductos.length > 0
          ? { create: detallesProductos }
          : undefined,
        orden_combos: detallesCombos.length > 0
          ? { create: detallesCombos }
          : undefined,
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
    // Historial se crea en la misma transacción
    // (se hace abajo porque necesitamos el id de la orden)
  ])

  // El historial necesita el id — va fuera de la transacción anterior
  // pero dentro de una propia para mantener atomicidad
  await prisma.orden_estados_historial.create({
    data: {
      orden_id: orden.id,
      estado:   'pendiente',
      notas:    'Orden creada',
    },
  })

  return orden
}

// ─── Obtener órdenes activas (del servicio abierto si existe) ─────────────────
export const getOrdenes = async () => {
  // Filtra por servicio activo si hay uno abierto, para no mezclar días
  const servicio = await getServicioActivo()

  return await prisma.ordenes.findMany({
    where: {
      estado: { not: 'cancelada' },
      ...(servicio ? { servicio_id: servicio.id } : {}),
    },
    include: {
      orden_detalles: {
        include: {
          productos: { select: { id: true, nombre: true } },
        },
      },
      orden_combos: {
        include: {
          combos: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: { creado_en: 'desc' },
  })
}

// ─── Obtener orden por ID ─────────────────────────────────────────────────────
export const getOrdenById = async (id: number) => {
  return await prisma.ordenes.findUnique({
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
      orden_estados_historial: {
        orderBy: { registrado_en: 'asc' },
      },
    },
  })
}

// ─── Cambiar estado de la orden ───────────────────────────────────────────────
// Transiciones válidas — evita saltos de estado incoherentes
const TRANSICIONES: Record<string, string[]> = {
  pendiente:       ['en_preparacion', 'cancelada'],
  en_preparacion:  ['lista', 'cancelada'],
  lista:           ['entregada', 'cancelada'],
  entregada:       [],
  cancelada:       [],
}

export const cambiarEstadoOrden = async (
  id: number,
  estado: string,
  empleadoId?: number
) => {
  const orden = await prisma.ordenes.findUnique({ where: { id } })
  if (!orden) throw new Error('Orden no encontrada')

  const transicionesValidas = TRANSICIONES[orden.estado] ?? []
  if (!transicionesValidas.includes(estado)) {
    throw new Error(
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
export const getOrdenesByUsuario = async (usuarioId: number) => {
  return await prisma.ordenes.findMany({
    where: { usuario_id: usuarioId },
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
  })
}