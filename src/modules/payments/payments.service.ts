import { prisma } from '../../config/db'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProcesarPagoDTO {
  ordenId: number
  metodoPagoId: number
  monto: number
  referencia?: string
}

// ─── Procesar pago ────────────────────────────────────────────────────────────
export const procesarPago = async (datos: ProcesarPagoDTO) => {
  // 1. Verificar que la orden existe y no está pagada ni cancelada
  const orden = await prisma.ordenes.findUnique({
    where: { id: datos.ordenId },
    include: { pagos: true }
  })

  if (!orden) {
    throw new Error('Orden no encontrada')
  }

  if (orden.estado === 'cancelada') {
    throw new Error('No se puede pagar una orden cancelada')
  }

  // 2. Verificar que el método de pago existe
  const metodoPago = await prisma.metodos_pago.findUnique({
    where: { id: datos.metodoPagoId }
  })

  if (!metodoPago) {
    throw new Error('Método de pago no válido')
  }

  // 3. Calcular total ya pagado
  const totalPagado = orden.pagos.reduce(
    (sum, p) => sum + parseFloat(p.monto.toString()), 0
  )
  const totalOrden = parseFloat(orden.total?.toString() ?? '0')
  const restante = totalOrden - totalPagado

  if (datos.monto > restante + 0.01) {
    throw new Error(`El monto excede el restante a pagar ($${restante.toFixed(2)})`)
  }

  // 4. Registrar el pago
  const pago = await prisma.pagos.create({
    data: {
      orden_id: datos.ordenId,
      metodo_pago_id: datos.metodoPagoId,
      monto: datos.monto,
      referencia: datos.referencia ?? null,
    },
    include: {
      metodos_pago: { select: { id: true, nombre: true } }
    }
  })

  // 5. Verificar si la orden quedó completamente pagada
  const nuevoTotalPagado = totalPagado + datos.monto
  const ordenPagada = nuevoTotalPagado >= totalOrden - 0.01

  if (ordenPagada) {
    await prisma.ordenes.update({
      where: { id: datos.ordenId },
      data: { estado: 'entregada', actualizado_en: new Date() }
    })
  }

  return {
    pago,
    ordenPagada,
    totalOrden,
    totalPagado: nuevoTotalPagado,
    cambio: datos.monto > restante ? datos.monto - restante : 0,
    restante: ordenPagada ? 0 : restante - datos.monto,
  }
}

// ─── Obtener métodos de pago ──────────────────────────────────────────────────
export const getMetodosPago = async () => {
  return await prisma.metodos_pago.findMany()
}

// ─── Obtener pagos de una orden ───────────────────────────────────────────────
export const getPagosByOrden = async (ordenId: number) => {
  const orden = await prisma.ordenes.findUnique({
    where: { id: ordenId },
    include: {
      pagos: {
        include: {
          metodos_pago: { select: { id: true, nombre: true } }
        },
        orderBy: { pagado_en: 'asc' }
      },
      orden_detalles: {
        include: {
          productos: { select: { id: true, nombre: true, precio_base: true } }
        }
      },
      orden_combos: {
        include: {
          combos: { select: { id: true, nombre: true, precio: true } }
        }
      }
    }
  })

  if (!orden) throw new Error('Orden no encontrada')

  const totalPagado = orden.pagos.reduce(
    (sum, p) => sum + parseFloat(p.monto.toString()), 0
  )
  const totalOrden = parseFloat(orden.total?.toString() ?? '0')

  return {
    orden,
    totalPagado,
    restante: Math.max(0, totalOrden - totalPagado),
    pagada: totalPagado >= totalOrden - 0.01,
  }
}

// ─── Obtener órdenes pendientes de pago ──────────────────────────────────────
export const getOrdenesPendientesPago = async () => {
  return await prisma.ordenes.findMany({
    where: {
      estado: { in: ['pendiente', 'en_preparacion', 'lista', 'entregada'] }
    },
    include: {
      pagos: true,
      orden_detalles: {
        include: {
          productos: { select: { nombre: true } }
        }
      },
      orden_combos: {
        include: {
          combos: { select: { nombre: true } }
        }
      }
    },
    orderBy: { creado_en: 'asc' }
  })
}