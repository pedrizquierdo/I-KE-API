import { prisma } from '../../config/db'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FiltroReporte {
  fechaInicio?: Date
  fechaFin?: Date
  servicioId?: number
}

// ─── Reporte de ventas ────────────────────────────────────────────────────────
export const getReporteVentas = async (filtros: FiltroReporte) => {
  const where: any = {
    estado: { not: 'cancelada' },
  }

  if (filtros.fechaInicio || filtros.fechaFin) {
    where.creado_en = {}
    if (filtros.fechaInicio) {
      const inicio = new Date(filtros.fechaInicio)
      inicio.setHours(0, 0, 0, 0)
      where.creado_en.gte = inicio
    }
    if (filtros.fechaFin) {
      const fin = new Date(filtros.fechaFin)
      fin.setHours(23, 59, 59, 999)
      where.creado_en.lte = fin
    }
  }

  if (filtros.servicioId) where.servicio_id = filtros.servicioId

  const ordenes = await prisma.ordenes.findMany({
    where,
    include: {
      orden_detalles: {
        include: {
          productos: {
            select: { id: true, nombre: true, categoria_id: true }
          }
        }
      },
      orden_combos: {
        include: {
          combos: { select: { id: true, nombre: true } }
        }
      },
      pagos: {
        include: {
          metodos_pago: { select: { nombre: true } }
        }
      }
    },
    orderBy: { creado_en: 'asc' }
  })

  // ── A. Resumen ejecutivo ──────────────────────────────────────────────────
  const totalVentas = ordenes.reduce(
    (sum, o) => sum + parseFloat(o.total?.toString() ?? '0'), 0
  )
  const totalOrdenes = ordenes.length
  const ticketPromedio = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0

  // ── B. Ventas por método de pago ──────────────────────────────────────────
  const ventasPorMetodo: Record<string, number> = {}
  ordenes.forEach((orden) => {
    orden.pagos.forEach((pago) => {
      const metodo = pago.metodos_pago.nombre
      ventasPorMetodo[metodo] = (ventasPorMetodo[metodo] ?? 0) + parseFloat(pago.monto.toString())
    })
  })

  // ── C. Productos más vendidos ─────────────────────────────────────────────
  const productosVendidos: Record<number, { nombre: string; cantidad: number; total: number }> = {}
  ordenes.forEach((orden) => {
    orden.orden_detalles.forEach((detalle) => {
      const id = detalle.productos.id
      if (!productosVendidos[id]) {
        productosVendidos[id] = { nombre: detalle.productos.nombre, cantidad: 0, total: 0 }
      }
      productosVendidos[id]!.cantidad += detalle.cantidad
      productosVendidos[id]!.total += parseFloat(detalle.subtotal?.toString() ?? '0')
    })
    orden.orden_combos.forEach((combo) => {
      const id = combo.combos.id
      const key = `combo_${id}`
      if (!productosVendidos[key as any]) {
        productosVendidos[key as any] = { nombre: `[Combo] ${combo.combos.nombre}`, cantidad: 0, total: 0 }
      }
      productosVendidos[key as any]!.cantidad += combo.cantidad
      productosVendidos[key as any]!.total += parseFloat(combo.subtotal?.toString() ?? '0')
    })
  })

  const topProductos = Object.values(productosVendidos)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10)

  // ── D. Ventas por hora ────────────────────────────────────────────────────
  const ventasPorHora: Record<number, { ordenes: number; total: number }> = {}
  ordenes.forEach((orden) => {
    const hora = new Date(orden.creado_en).toLocaleString('es-MX', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Hermosillo'
    })
    const horaNum = parseInt(hora)
    if (!ventasPorHora[horaNum]) ventasPorHora[horaNum] = { ordenes: 0, total: 0 }
    ventasPorHora[horaNum]!.ordenes += 1
    ventasPorHora[horaNum]!.total += parseFloat(orden.total?.toString() ?? '0')
  })

  return {
    resumen: {
      totalVentas: parseFloat(totalVentas.toFixed(2)),
      totalOrdenes,
      ticketPromedio: parseFloat(ticketPromedio.toFixed(2)),
      ordenesCompletadas: ordenes.filter((o) => o.estado === 'entregada').length,
      ordenesPendientes: ordenes.filter((o) => o.estado !== 'entregada').length,
    },
    ventasPorMetodoPago: ventasPorMetodo,
    topProductos,
    ventasPorHora,
    ordenes: ordenes.map((o) => ({
      id: o.id,
      numero: o.numero,
      estado: o.estado,
      total: o.total,
      creado_en: o.creado_en,
    }))
  }
}

// ─── Dashboard del día ────────────────────────────────────────────────────────
export const getDashboard = async () => {
  const hoy = new Date()
  const inicioHoy = new Date(hoy.toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' }))
  const finHoy = new Date(inicioHoy)
  finHoy.setDate(finHoy.getDate() + 1)

  // Servicio activo
  const servicioActivo = await prisma.servicios.findFirst({
    where: { estado: 'abierto' },
    include: {
      ubicaciones: { select: { nombre: true } }
    }
  })

  // Órdenes del día
  const ordenesHoy = await prisma.ordenes.findMany({
    where: {
      creado_en: { gte: inicioHoy, lt: finHoy },
      estado: { not: 'cancelada' }
    },
    include: { pagos: true }
  })

  const ventasHoy = ordenesHoy.reduce(
    (sum, o) => sum + parseFloat(o.total?.toString() ?? '0'), 0
  )

  // Órdenes activas por estado
  const ordenesPorEstado = await prisma.ordenes.groupBy({
    by: ['estado'],
    where: {
      estado: { in: ['pendiente', 'en_preparacion', 'lista'] }
    },
    _count: { estado: true }
  })

  // Alertas de stock bajo
  const alertasStock = await prisma.ingredientes.count({
    where: {
      activo: true,
      stock_actual: { lte: prisma.ingredientes.fields.stock_minimo }
    }
  })

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