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
