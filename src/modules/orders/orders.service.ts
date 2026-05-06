import { prisma } from '../../config/db'
import { getServicioActivo } from '../services/services.service'
import { getEmpleadoId } from '../../config/helpers'
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
  latitudEntrega?: number
  longitudEntrega?: number
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
        latitud_entrega:   datos.latitudEntrega  ?? null,
        longitud_entrega:  datos.longitudEntrega ?? null,
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
//
// El flujo varía según tipo_servicio:
//   domicilio   → lista → entregada (el repartidor entrega) → fin
//   mostrador / mesa / para_llevar → lista → pagada (el cajero cobra) → fin
//
// En todos los casos cancelada está disponible hasta lista (inclusive).

function getTransiciones(tipoServicio: string): Record<string, string[]> {
  const desdeListaFinal = tipoServicio === 'domicilio'
    ? ['entregada', 'cancelada']
    : ['pagada',    'cancelada']

  return {
    pendiente:      ['en_preparacion', 'cancelada'],
    en_preparacion: ['lista', 'cancelada'],
    lista:          desdeListaFinal,
    entregada:      [],
    pagada:         [],
    cancelada:      [],
  }
}

export const cambiarEstadoOrden = async (
  id: number,
  estado: string,
  usuarioId?: number,         // recibe usuario.id — se resuelve a empleado.id internamente
  rolUsuario?: string         // rol del usuario autenticado, para validar permisos
) => {
  const orden = await prisma.ordenes.findUnique({ where: { id } })
  if (!orden) throw new AppError(404, 'Orden no encontrada')

  const transiciones      = getTransiciones(orden.tipo_servicio)
  const transicionesValidas = transiciones[orden.estado] ?? []
  if (!transicionesValidas.includes(estado)) {
    throw new AppError(
      422,
      `No se puede pasar de "${orden.estado}" a "${estado}". ` +
      `Transiciones válidas: ${transicionesValidas.join(', ') || 'ninguna'}`
    )
  }

  // Solo el repartidor (o gerente) puede marcar como entregada una orden a domicilio
  if (
    estado === 'entregada' &&
    orden.tipo_servicio === 'domicilio' &&
    !['repartidor', 'gerente'].includes(rolUsuario ?? '')
  ) {
    throw new AppError(
      403,
      'Solo el repartidor puede marcar como entregada una orden a domicilio'
    )
  }

  // Resolver el empleado_id real (FK a tabla empleados, no usuarios)
  const empleadoId = await getEmpleadoId(usuarioId)

  const [ordenActualizada] = await prisma.$transaction([
    prisma.ordenes.update({
      where: { id },
      data: { estado, actualizado_en: new Date() },
    }),
    prisma.orden_estados_historial.create({
      data: { orden_id: id, estado, empleado_id: empleadoId },
    }),
  ])

  // ── Descuento automático de inventario al iniciar preparación ──────────────
  if (estado === 'en_preparacion') {
    await descontarIngredientes(id, ordenActualizada.numero)
  }

  return ordenActualizada
}

// ─── Descuento de ingredientes por receta ─────────────────────────────────────
async function descontarIngredientes(ordenId: number, numeroOrden: string): Promise<void> {
  // 1. Cargar la orden con productos directos y productos dentro de combos
  const ordenCompleta = await prisma.ordenes.findUnique({
    where: { id: ordenId },
    include: {
      orden_detalles: {
        select: { producto_id: true, cantidad: true },
      },
      orden_combos: {
        select: {
          cantidad: true,
          combos: {
            select: {
              combo_items: {
                select: { producto_id: true, cantidad: true },
              },
            },
          },
        },
      },
    },
  })

  if (!ordenCompleta) return

  // 2. Acumular productos + cantidades (directos y dentro de combos)
  //    Usamos un Map para colapsar duplicados (mismo producto_id en varias filas)
  const productosMap = new Map<number, number>()

  for (const d of ordenCompleta.orden_detalles) {
    productosMap.set(
      d.producto_id,
      (productosMap.get(d.producto_id) ?? 0) + d.cantidad,
    )
  }

  for (const oc of ordenCompleta.orden_combos) {
    for (const item of oc.combos.combo_items) {
      const total = item.cantidad * oc.cantidad
      productosMap.set(
        item.producto_id,
        (productosMap.get(item.producto_id) ?? 0) + total,
      )
    }
  }

  if (productosMap.size === 0) return

  // 3. Traer todas las recetas para los productos de la orden en una sola query
  const recetas = await prisma.recetas.findMany({
    where: { producto_id: { in: [...productosMap.keys()] } },
    select: { producto_id: true, ingrediente_id: true, cantidad: true },
  })

  if (recetas.length === 0) return

  // 4. Calcular la cantidad total a descontar por ingrediente
  const descuentoMap = new Map<number, number>() // ingrediente_id → cantidad a restar

  for (const receta of recetas) {
    const cantProd  = productosMap.get(receta.producto_id) ?? 0
    const aDescontar = toNum(receta.cantidad) * cantProd
    descuentoMap.set(
      receta.ingrediente_id,
      (descuentoMap.get(receta.ingrediente_id) ?? 0) + aDescontar,
    )
  }

  // 5. Traer stock actual de los ingredientes involucrados en una sola query
  const ingIds = [...descuentoMap.keys()]
  const ingredientes = await prisma.ingredientes.findMany({
    where: { id: { in: ingIds } },
    select: { id: true, stock_actual: true },
  })
  const stockMap = new Map(ingredientes.map((i) => [i.id, toNum(i.stock_actual)]))

  // 6. Ejecutar todas las actualizaciones en una sola transacción
  const motivo = `Orden ${numeroOrden}`
  await prisma.$transaction(
    ingIds.flatMap((ingId) => {
      const aDescontar   = descuentoMap.get(ingId) ?? 0
      const stockActual  = stockMap.get(ingId) ?? 0
      const nuevoStock   = Math.max(0, stockActual - aDescontar)
      const cantMovimiento = -(Math.min(aDescontar, stockActual)) // negativo, nunca menor que -stockActual

      return [
        prisma.ingredientes.update({
          where: { id: ingId },
          data:  { stock_actual: nuevoStock },
        }),
        prisma.movimientos_inventario.create({
          data: {
            ingrediente_id: ingId,
            tipo:           'venta',
            cantidad:       cantMovimiento,
            referencia_id:  ordenId,
            motivo,
          },
        }),
      ]
    }),
  )
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
  usuarioId?: number,
  rolUsuario?: string,
) => {
  // ── 1. Cargar orden con sus items actuales ───────────────────────────────────
  const orden = await prisma.ordenes.findUnique({
    where: { id: ordenId },
    include: { orden_detalles: true, orden_combos: true },
  })
  if (!orden) throw new AppError(404, 'Orden no encontrada')

  // Clientes solo pueden modificar sus propias órdenes y únicamente si están pendientes
  if (rolUsuario === 'cliente') {
    if (orden.usuario_id !== usuarioId) {
      throw new AppError(403, 'No tienes permiso para modificar esta orden')
    }
    if (orden.estado !== 'pendiente') {
      throw new AppError(400, 'Solo puedes modificar órdenes en estado pendiente')
    }
  }

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

// ─── Asignar repartidor a una orden ──────────────────────────────────────────
export const asignarRepartidor = async (ordenId: number, repartidorId: number) => {
  const orden = await prisma.ordenes.findUnique({ where: { id: ordenId } })
  if (!orden) throw new AppError(404, 'Orden no encontrada')
  if (orden.tipo_servicio !== 'domicilio') {
    throw new AppError(400, 'Solo se puede asignar repartidor a órdenes de tipo domicilio')
  }

  // Verificar que el empleado existe y tiene rol repartidor
  const empleado = await prisma.empleados.findUnique({ where: { id: repartidorId } })
  if (!empleado) throw new AppError(404, 'Repartidor no encontrado')
  if (empleado.rol !== 'repartidor') {
    throw new AppError(400, `El empleado ${repartidorId} no tiene rol de repartidor`)
  }

  await prisma.ordenes.update({
    where: { id: ordenId },
    data:  { repartidor_id: repartidorId, actualizado_en: new Date() },
  })

  return getOrdenById(ordenId)
}

// ─── Mis repartos (vista del repartidor autenticado o del gerente) ───────────
// Repartidor → solo las órdenes que tiene asignadas (filtro por empleado_id).
// Gerente    → todas las órdenes de domicilio activas (sin filtro de repartidor).
const ESTADOS_ACTIVOS_REPARTIDOR = ['lista', 'en_preparacion']

export const getMyDeliveries = async (usuarioId: number, rol: string, pagination?: PaginationParams) => {
  const page  = Math.max(1, pagination?.page ?? 1)
  const limit = Math.min(100, Math.max(1, pagination?.limit ?? 50))
  const skip  = (page - 1) * limit

  const where: {
    tipo_servicio: string
    estado: { in: string[] }
    repartidor_id?: number
  } = {
    tipo_servicio: 'domicilio',
    estado: { in: ESTADOS_ACTIVOS_REPARTIDOR },
  }

  if (rol === 'repartidor') {
    // Obtener el empleado_id vinculado al usuario autenticado
    const usuario = await prisma.usuarios.findUnique({
      where:  { id: usuarioId },
      select: { empleado_id: true },
    })
    if (!usuario?.empleado_id) {
      // Sin empleado vinculado → sin entregas asignadas, no es un error
      return { items: [], total: 0, page, limit, totalPages: 0 }
    }
    where.repartidor_id = usuario.empleado_id
  }
  // rol === 'gerente': no se añade repartidor_id → devuelve todas las entregas activas

  const [items, total] = await Promise.all([
    prisma.ordenes.findMany({
      where,
      select: {
        id:                      true,
        numero:                  true,
        estado:                  true,
        tipo_servicio:           true,
        nombre_cliente:          true,
        telefono_cliente:        true,
        direccion_entrega:       true,
        latitud_entrega:         true,
        longitud_entrega:        true,
        notas_orden:             true,
        subtotal:                true,
        total:                   true,
        tiempo_estimado_minutos: true,
        creado_en:               true,
        actualizado_en:          true,
        orden_detalles: {
          include: { productos: { select: { id: true, nombre: true, precio_base: true } } },
        },
        orden_combos: {
          include: { combos: { select: { id: true, nombre: true, precio: true } } },
        },
      },
      orderBy: { creado_en: 'asc' },
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
      select: {
        id: true,
        numero: true,
        estado: true,
        tipo_servicio: true,
        nombre_cliente: true,
        telefono_cliente: true,
        direccion_entrega: true,
        latitud_entrega: true,
        longitud_entrega: true,
        subtotal: true,
        total: true,
        notas_orden: true,
        creado_en: true,
        actualizado_en: true,
        tiempo_estimado_minutos: true,
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
        pagos: {
          select: {
            id: true,
            comprobante_url: true,
            confirmado: true,
            metodo_pago_id: true,
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
