import { prisma } from '../../config/db'
import { cache } from '../../lib/cache'

const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutos

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FiltroReporte {
  fechaInicio?: string   // "YYYY-MM-DD" en hora local Hermosillo
  fechaFin?: string      // "YYYY-MM-DD" en hora local Hermosillo
  servicioId?: number
}

// ─── Helpers de fecha (Hermosillo = UTC-7, sin DST) ──────────────────────────
const inicioDia = (fecha: string): Date => new Date(`${fecha}T00:00:00-07:00`)
const finDia    = (fecha: string): Date => new Date(`${fecha}T23:59:59.999-07:00`)

// ─── Reporte de ventas ────────────────────────────────────────────────────────
export const getReporteVentas = async (filtros: FiltroReporte) => {
  const cacheKey = `reporte:${filtros.fechaInicio ?? ''}:${filtros.fechaFin ?? ''}:${filtros.servicioId ?? ''}`
  const cached = cache.get<ReturnType<typeof buildReporte>>(cacheKey)
  if (cached) return cached

  const where: any = { estado: { not: 'cancelada' } }

  if (filtros.fechaInicio || filtros.fechaFin) {
    where.creado_en = {}
    if (filtros.fechaInicio) where.creado_en.gte = inicioDia(filtros.fechaInicio)
    if (filtros.fechaFin)    where.creado_en.lte = finDia(filtros.fechaFin)
  }
  if (filtros.servicioId) where.servicio_id = filtros.servicioId

  const ordenes = await prisma.ordenes.findMany({
    where,
    include: {
      orden_detalles: {
        include: { productos: { select: { id: true, nombre: true, categoria_id: true } } }
      },
      orden_combos: {
        include: { combos: { select: { id: true, nombre: true } } }
      },
      pagos: {
        include: { metodos_pago: { select: { nombre: true } } }
      }
    },
    orderBy: { creado_en: 'asc' }
  })

  const result = buildReporte(ordenes)
  cache.set(cacheKey, result, CACHE_TTL_MS)
  return result
}

// ─── Dashboard del día ────────────────────────────────────────────────────────
export const getDashboard = async () => {
  const cacheKey = 'dashboard:hoy'
  const cached = cache.get<Awaited<ReturnType<typeof buildDashboard>>>(cacheKey)
  if (cached) return cached

  const result = await buildDashboard()
  cache.set(cacheKey, result, CACHE_TTL_MS)
  return result
}

// ─── Comparación de períodos ──────────────────────────────────────────────────
interface MetricasPeriodo {
  totalVentas:    number
  totalOrdenes:   number
  ticketPromedio: number
  topProductos:   { id: string; nombre: string; cantidad: number; total: number }[]
}

// Consulta optimizada: solo las columnas necesarias para la comparación.
// Ambas llamadas se ejecutan en paralelo desde compararVentas.
async function getMetricasPeriodo(inicio: Date, fin: Date): Promise<MetricasPeriodo> {
  const ordenes = await prisma.ordenes.findMany({
    where: {
      estado:    { not: 'cancelada' },
      creado_en: { gte: inicio, lte: fin },
    },
    select: {
      total: true,
      orden_detalles: {
        select: {
          cantidad:        true,
          subtotal:        true,   // nullable — dbgenerated solo aplica en INSERT
          precio_unitario: true,   // fallback si subtotal es null
          productos: { select: { id: true, nombre: true } },
        },
      },
      orden_combos: {
        select: {
          cantidad:        true,
          subtotal:        true,
          precio_unitario: true,
          combos: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  const totalOrdenes   = ordenes.length
  const totalVentas    = ordenes.reduce((s, o) => s + parseFloat(o.total?.toString() ?? '0'), 0)
  const ticketPromedio = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0

  // Acumular ventas por producto/combo
  const productosMap: Record<string, { nombre: string; cantidad: number; total: number }> = {}

  for (const o of ordenes) {
    for (const d of o.orden_detalles) {
      const key = String(d.productos.id)
      if (!productosMap[key])
        productosMap[key] = { nombre: d.productos.nombre, cantidad: 0, total: 0 }
      // subtotal puede ser null (row insertada antes de la corrección del dbgenerated)
      const importe = d.subtotal
        ? parseFloat(d.subtotal.toString())
        : parseFloat(d.precio_unitario.toString()) * d.cantidad
      productosMap[key]!.cantidad += d.cantidad
      productosMap[key]!.total   += importe
    }
    for (const c of o.orden_combos) {
      const key = `combo_${c.combos.id}`
      if (!productosMap[key])
        productosMap[key] = { nombre: `[Combo] ${c.combos.nombre}`, cantidad: 0, total: 0 }
      const importe = c.subtotal
        ? parseFloat(c.subtotal.toString())
        : parseFloat(c.precio_unitario.toString()) * c.cantidad
      productosMap[key]!.cantidad += c.cantidad
      productosMap[key]!.total   += importe
    }
  }

  const topProductos = Object.entries(productosMap)
    .map(([id, data]) => ({ id, ...data, total: parseFloat(data.total.toFixed(2)) }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)

  return {
    totalVentas:    parseFloat(totalVentas.toFixed(2)),
    totalOrdenes,
    ticketPromedio: parseFloat(ticketPromedio.toFixed(2)),
    topProductos,
  }
}

// Variación absoluta y porcentual entre dos valores (v1 = base, v2 = nuevo).
// porcentaje es null cuando la base es 0 (evita división por cero / Infinity).
function delta(v1: number, v2: number) {
  return {
    absoluta:   parseFloat((v2 - v1).toFixed(2)),
    porcentaje: v1 !== 0
      ? parseFloat((((v2 - v1) / v1) * 100).toFixed(1))
      : null,
  }
}

function buildComparacion(
  p1Inicio: string, p1Fin: string,
  p2Inicio: string, p2Fin: string,
  m1: MetricasPeriodo,
  m2: MetricasPeriodo,
) {
  // Unión de los top productos de ambos períodos para la tabla comparativa.
  // Si un producto solo apareció en uno de los dos, el otro queda como null.
  const todosIds = new Set([
    ...m1.topProductos.map(p => p.id),
    ...m2.topProductos.map(p => p.id),
  ])
  const p1Map = Object.fromEntries(m1.topProductos.map(p => [p.id, p]))
  const p2Map = Object.fromEntries(m2.topProductos.map(p => [p.id, p]))

  const topProductosComparado = [...todosIds]
    .map(id => {
      const p1  = p1Map[id] ?? null
      const p2  = p2Map[id] ?? null
      const ref = (p1 ?? p2)!
      return {
        id,
        nombre:            ref.nombre,
        periodo1:          p1 ? { cantidad: p1.cantidad, total: p1.total } : null,
        periodo2:          p2 ? { cantidad: p2.cantidad, total: p2.total } : null,
        variacionCantidad: delta(p1?.cantidad ?? 0, p2?.cantidad ?? 0),
        variacionTotal:    delta(p1?.total    ?? 0, p2?.total    ?? 0),
      }
    })
    // Ordenar por popularidad combinada de ambos períodos
    .sort((a, b) => {
      const totalA = (a.periodo1?.cantidad ?? 0) + (a.periodo2?.cantidad ?? 0)
      const totalB = (b.periodo1?.cantidad ?? 0) + (b.periodo2?.cantidad ?? 0)
      return totalB - totalA
    })

  return {
    periodo1: { inicio: p1Inicio, fin: p1Fin, ...m1 },
    periodo2: { inicio: p2Inicio, fin: p2Fin, ...m2 },
    variacion: {
      totalVentas:    delta(m1.totalVentas,    m2.totalVentas),
      totalOrdenes:   delta(m1.totalOrdenes,   m2.totalOrdenes),
      ticketPromedio: delta(m1.ticketPromedio, m2.ticketPromedio),
    },
    topProductosComparado,
  }
}

export const compararVentas = async (
  p1Inicio: string, p1Fin: string,
  p2Inicio: string, p2Fin: string,
) => {
  const cacheKey = `compare:${p1Inicio}:${p1Fin}:${p2Inicio}:${p2Fin}`
  const cached = cache.get<ReturnType<typeof buildComparacion>>(cacheKey)
  if (cached) return cached

  // Los dos períodos se consultan en paralelo — mitad del tiempo de respuesta
  const [m1, m2] = await Promise.all([
    getMetricasPeriodo(inicioDia(p1Inicio), finDia(p1Fin)),
    getMetricasPeriodo(inicioDia(p2Inicio), finDia(p2Fin)),
  ])

  const result = buildComparacion(p1Inicio, p1Fin, p2Inicio, p2Fin, m1, m2)
  // TTL más largo que el dashboard: datos históricos no cambian con frecuencia
  cache.set(cacheKey, result, 5 * 60 * 1000)
  return result
}

// ─── Reporte de consumo de inventario (tipo = 'venta') ───────────────────────
export const getReporteInventario = async (filtros: {
  fechaInicio?: string
  fechaFin?:    string
}) => {
  const cacheKey = `inventario:${filtros.fechaInicio ?? ''}:${filtros.fechaFin ?? ''}`
  const cached = cache.get<ReturnType<typeof buildReporteInventario>>(cacheKey)
  if (cached) return cached

  // Construir el filtro de fecha de forma incremental
  const whereBase = {
    tipo: 'venta',
    ...(filtros.fechaInicio || filtros.fechaFin
      ? {
          creado_en: {
            ...(filtros.fechaInicio ? { gte: inicioDia(filtros.fechaInicio) } : {}),
            ...(filtros.fechaFin    ? { lte: finDia(filtros.fechaFin)       } : {}),
          },
        }
      : {}),
  }

  // groupBy por ingrediente + count total — en paralelo
  const [grupos, totalMovimientos] = await Promise.all([
    prisma.movimientos_inventario.groupBy({
      by:     ['ingrediente_id'],
      where:  whereBase,
      _sum:   { cantidad: true },
      _count: { _all: true },
    }),
    prisma.movimientos_inventario.count({ where: whereBase }),
  ])

  // Fetch de ingredientes en batch — evitar N+1
  const ingIds = grupos.map(g => g.ingrediente_id)
  const ingredientes = ingIds.length > 0
    ? await prisma.ingredientes.findMany({
        where:  { id: { in: ingIds } },
        select: {
          id:             true,
          nombre:         true,
          costo_unitario: true,
          unidades_medida: { select: { simbolo: true } },
        },
      })
    : []

  const result = buildReporteInventario(
    filtros.fechaInicio ?? null,
    filtros.fechaFin    ?? null,
    grupos,
    ingredientes,
    totalMovimientos,
  )
  cache.set(cacheKey, result, 3 * 60 * 1000) // 3 min — datos de stock cambian con frecuencia
  return result
}

function buildReporteInventario(
  fechaInicio:      string | null,
  fechaFin:         string | null,
  grupos:           any[],
  ingredientes:     any[],
  totalMovimientos: number,
) {
  const ingMap = new Map(ingredientes.map((i: any) => [i.id, i]))

  const consumos = grupos
    .map((g: any) => {
      const ing = ingMap.get(g.ingrediente_id)

      // Math.abs porque movimientos de consumo (tipo 'venta') pueden almacenarse
      // con cantidad negativa (misma convención que 'merma' / 'caducidad').
      const cantidadConsumida = Math.abs(
        parseFloat(g._sum.cantidad?.toString() ?? '0'),
      )

      const costoUnitario: number | null = ing?.costo_unitario != null
        ? parseFloat(ing.costo_unitario.toString())
        : null

      const costoTotal: number | null = costoUnitario !== null
        ? parseFloat((cantidadConsumida * costoUnitario).toFixed(2))
        : null

      return {
        ingredienteId:     g.ingrediente_id as number,
        nombre:            ing?.nombre ?? `Ingrediente #${g.ingrediente_id}`,
        unidad:            (ing?.unidades_medida?.simbolo as string) ?? '?',
        cantidadConsumida: parseFloat(cantidadConsumida.toFixed(3)),
        costoUnitario,
        costoTotal,
        totalMovimientos:  g._count._all as number,
      }
    })
    .sort((a, b) => b.cantidadConsumida - a.cantidadConsumida) // mayor consumo primero

  const costoTotalConsumo = parseFloat(
    consumos.reduce((s, c) => s + (c.costoTotal ?? 0), 0).toFixed(2),
  )
  const ingredientesSinCosto = consumos.filter(c => c.costoUnitario === null).length

  return {
    resumen: {
      periodo:           { inicio: fechaInicio, fin: fechaFin },
      totalIngredientes: consumos.length,
      totalMovimientos,
      costoTotalConsumo,
      // Aviso explícito: el costo total es parcial si algún ingrediente no tiene precio
      ingredientesSinCosto,
      costoParcial: ingredientesSinCosto > 0,
    },
    consumos,
  }
}

// ─── Helpers privados ─────────────────────────────────────────────────────────
function buildReporte(ordenes: any[]) {
  // A. Resumen ejecutivo
  const totalFacturado = ordenes.reduce((sum, o) => sum + parseFloat(o.total?.toString() ?? '0'), 0)
  const totalCobrado = ordenes.reduce(
    (sum, o) => sum + o.pagos.reduce((s: number, p: any) => s + parseFloat(p.monto.toString()), 0), 0
  )
  const totalOrdenes = ordenes.length
  const ticketPromedio = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0

  // B. Ventas por método de pago
  const ventasPorMetodo: Record<string, number> = {}
  ordenes.forEach((orden) => {
    orden.pagos.forEach((pago: any) => {
      const metodo = pago.metodos_pago.nombre
      ventasPorMetodo[metodo] = (ventasPorMetodo[metodo] ?? 0) + parseFloat(pago.monto.toString())
    })
  })

  // C. Productos más vendidos
  const productosVendidos: Record<string, { nombre: string; cantidad: number; total: number }> = {}
  ordenes.forEach((orden) => {
    orden.orden_detalles.forEach((detalle: any) => {
      const key = String(detalle.productos.id)
      if (!productosVendidos[key]) {
        productosVendidos[key] = { nombre: detalle.productos.nombre, cantidad: 0, total: 0 }
      }
      productosVendidos[key]!.cantidad += detalle.cantidad
      productosVendidos[key]!.total += parseFloat(detalle.subtotal?.toString() ?? '0')
    })
    orden.orden_combos.forEach((combo: any) => {
      const key = `combo_${combo.combos.id}`
      if (!productosVendidos[key]) {
        productosVendidos[key] = { nombre: `[Combo] ${combo.combos.nombre}`, cantidad: 0, total: 0 }
      }
      productosVendidos[key]!.cantidad += combo.cantidad
      productosVendidos[key]!.total += parseFloat(combo.subtotal?.toString() ?? '0')
    })
  })

  const topProductos = Object.values(productosVendidos)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)

  // D. Ventas por hora
  const ventasPorHora: Record<number, { ordenes: number; total: number }> = {}
  ordenes.forEach((orden) => {
    const hora = parseInt(new Date(orden.creado_en).toLocaleString('es-MX', {
      hour: 'numeric', hour12: false, timeZone: 'America/Hermosillo'
    }))
    if (!ventasPorHora[hora]) ventasPorHora[hora] = { ordenes: 0, total: 0 }
    ventasPorHora[hora]!.ordenes += 1
    ventasPorHora[hora]!.total += parseFloat(orden.total?.toString() ?? '0')
  })

  return {
    resumen: {
      totalFacturado: parseFloat(totalFacturado.toFixed(2)),
      totalCobrado: parseFloat(totalCobrado.toFixed(2)),
      porCobrar: parseFloat((totalFacturado - totalCobrado).toFixed(2)),
      totalOrdenes,
      ticketPromedio: parseFloat(ticketPromedio.toFixed(2)),
      ordenesEntregadas:    ordenes.filter((o) => o.estado === 'entregada').length,
      ordenesListas:        ordenes.filter((o) => o.estado === 'lista').length,
      ordenesEnPreparacion: ordenes.filter((o) => o.estado === 'en_preparacion').length,
      ordenesPendientes:    ordenes.filter((o) => o.estado === 'pendiente').length,
    },
    ventasPorMetodoPago: ventasPorMetodo,
    topProductos,
    ventasPorHora,
    ordenes: ordenes.map((o) => ({
      id: o.id, numero: o.numero, estado: o.estado, total: o.total, creado_en: o.creado_en,
    })),
  }
}

async function buildDashboard() {
  const hoy = new Date()
  const inicioHoy = new Date(hoy.toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' }))
  const finHoy = new Date(inicioHoy)
  finHoy.setDate(finHoy.getDate() + 1)

  const [servicioActivo, ordenesHoy, ordenesPorEstado, alertasStock] = await Promise.all([
    prisma.servicios.findFirst({
      where: { estado: 'abierto' },
      include: { ubicaciones: { select: { nombre: true } } }
    }),
    prisma.ordenes.findMany({
      where: { creado_en: { gte: inicioHoy, lt: finHoy }, estado: { not: 'cancelada' } },
      include: { pagos: true }
    }),
    prisma.ordenes.groupBy({
      by: ['estado'],
      where: { estado: { in: ['pendiente', 'en_preparacion', 'lista'] } },
      _count: { estado: true }
    }),
    prisma.ingredientes.count({
      where: {
        activo: true,
        stock_actual: { lte: prisma.ingredientes.fields.stock_minimo }
      }
    }),
  ])

  const ventasHoy = ordenesHoy.reduce(
    (sum, o) => sum + parseFloat(o.total?.toString() ?? '0'), 0
  )

  return {
    servicioActivo,
    resumenHoy: {
      totalVentas: parseFloat(ventasHoy.toFixed(2)),
      totalOrdenes: ordenesHoy.length,
      ticketPromedio: ordenesHoy.length > 0
        ? parseFloat((ventasHoy / ordenesHoy.length).toFixed(2))
        : 0,
    },
    ordenesPorEstado: ordenesPorEstado.reduce((acc, item) => {
      acc[item.estado] = item._count.estado
      return acc
    }, {} as Record<string, number>),
    alertasStock,
  }
}
