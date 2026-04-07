import { prisma } from '../../config/db'
import { Decimal } from '@prisma/client/runtime/library'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProcesarPagoDTO {
  ordenId:      number
  metodoPagoId: number
  monto:        number
  referencia?:  string
}

// ─── Helper: aritmética segura con Decimal ────────────────────────────────────
const toNum = (val: Decimal | string | number | null | undefined): number =>
  new Decimal(val?.toString() ?? '0').toNumber()

// ─── Procesar pago ────────────────────────────────────────────────────────────
export const procesarPago = async (datos: ProcesarPagoDTO) => {
  // 1. Verificar que la orden existe y no está cancelada
  const orden = await prisma.ordenes.findUnique({
    where:   { id: datos.ordenId },
    include: { pagos: true },
  })

  if (!orden) throw new Error('Orden no encontrada')
  if (orden.estado === 'cancelada') {
    throw new Error('No se puede pagar una orden cancelada')
  }

  // 2. Verificar método de pago
  const metodoPago = await prisma.metodos_pago.findUnique({
    where: { id: datos.metodoPagoId },
  })
  if (!metodoPago) throw new Error('Método de pago no válido')

  // 3. Calcular montos con Decimal para evitar errores de punto flotante
  const totalOrden   = toNum(orden.total)
  const totalPagado  = orden.pagos.reduce((sum, p) => sum + toNum(p.monto), 0)
  const restante     = parseFloat((totalOrden - totalPagado).toFixed(2))

  if (datos.monto <= 0) {
    throw new Error('El monto debe ser mayor a cero')
  }

  if (datos.monto > restante + 0.01) {
    throw new Error(`El monto excede el restante a pagar ($${restante.toFixed(2)})`)
  }

  // 4. Registrar el pago
  const pago = await prisma.pagos.create({
    data: {
      orden_id:       datos.ordenId,
      metodo_pago_id: datos.metodoPagoId,
      monto:          datos.monto,
      referencia:     datos.referencia ?? null,
    },
    include: {
      metodos_pago: { select: { id: true, nombre: true } },
    },
  })

  // 5. Calcular si quedó completamente pagada
  const nuevoTotalPagado = parseFloat((totalPagado + datos.monto).toFixed(2))
  const ordenPagada      = nuevoTotalPagado >= totalOrden - 0.01
  const cambio           = datos.monto > restante
    ? parseFloat((datos.monto - restante).toFixed(2))
    : 0

  // ─── NOTA IMPORTANTE ───────────────────────────────────────────────────────
  // El pago NO cambia automáticamente el estado de la orden.
  //
  // Razón: en un taquero, una orden puede estar pagada mientras aún está
  // en preparación o lista en la barra. El estado de la orden (flujo de cocina)
  // y el estado del pago son conceptos independientes.
  //
  // El cajero/mesero debe marcar la orden como "entregada" manualmente
  // a través de PATCH /orders/:id/status cuando se la entregue al cliente.
  // ───────────────────────────────────────────────────────────────────────────

  return {
    pago,
    ordenPagada,
    totalOrden,
    totalPagado:   nuevoTotalPagado,
    cambio,
    restante:      ordenPagada ? 0 : parseFloat((restante - datos.monto).toFixed(2)),
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
        include: { metodos_pago: { select: { id: true, nombre: true } } },
        orderBy: { pagado_en: 'asc' },
      },
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
  })

  if (!orden) throw new Error('Orden no encontrada')

  const totalOrden  = toNum(orden.total)
  const totalPagado = orden.pagos.reduce((sum, p) => sum + toNum(p.monto), 0)

  return {
    orden,
    totalOrden,
    totalPagado:  parseFloat(totalPagado.toFixed(2)),
    restante:     parseFloat(Math.max(0, totalOrden - totalPagado).toFixed(2)),
    pagada:       totalPagado >= totalOrden - 0.01,
  }
}

// ─── Órdenes pendientes de pago ───────────────────────────────────────────────
// Solo trae las que tienen saldo restante — filtra las ya pagadas en memoria
// para no requerir una columna extra en BD.
export const getOrdenesPendientesPago = async () => {
  const ordenes = await prisma.ordenes.findMany({
    where: {
      estado: { in: ['pendiente', 'en_preparacion', 'lista', 'entregada'] },
    },
    include: {
      pagos: true,
      orden_detalles: {
        include: { productos: { select: { nombre: true } } },
      },
      orden_combos: {
        include: { combos: { select: { nombre: true } } },
      },
    },
    orderBy: { creado_en: 'asc' },
  })

  // Enriquecer con info de pago y filtrar las completamente pagadas
  return ordenes
    .map((orden) => {
      const totalOrden  = toNum(orden.total)
      const totalPagado = orden.pagos.reduce((sum, p) => sum + toNum(p.monto), 0)
      const restante    = parseFloat(Math.max(0, totalOrden - totalPagado).toFixed(2))
      return { ...orden, totalPagado: parseFloat(totalPagado.toFixed(2)), restante, pagada: restante === 0 }
    })
    .filter((o) => !o.pagada)
}