import { prisma } from '../../config/db'
import { Decimal } from '@prisma/client/runtime/library'
import { AppError } from '../../lib/AppError'
import { cloudinary } from '../../config/cloudinary'

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
  const orden = await prisma.ordenes.findUnique({
    where:   { id: datos.ordenId },
    include: { pagos: true },
  })

  if (!orden) throw new AppError(404, 'Orden no encontrada')
  if (orden.estado === 'cancelada') throw new AppError(400, 'No se puede pagar una orden cancelada')

  const metodoPago = await prisma.metodos_pago.findUnique({
    where: { id: datos.metodoPagoId },
  })
  if (!metodoPago) throw new AppError(404, 'Método de pago no válido')

  const totalOrden   = toNum(orden.total)
  const totalPagado  = orden.pagos.reduce((sum, p) => sum + toNum(p.monto), 0)
  const restante     = parseFloat((totalOrden - totalPagado).toFixed(2))

  if (datos.monto <= 0) throw new AppError(400, 'El monto debe ser mayor a cero')
  if (datos.monto > restante + 0.01) {
    throw new AppError(400, `El monto excede el restante a pagar ($${restante.toFixed(2)})`)
  }

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

  const nuevoTotalPagado = parseFloat((totalPagado + datos.monto).toFixed(2))
  const ordenPagada      = nuevoTotalPagado >= totalOrden - 0.01
  const cambio           = datos.monto > restante
    ? parseFloat((datos.monto - restante).toFixed(2))
    : 0

  // ─── NOTA ──────────────────────────────────────────────────────────────────
  // El pago NO cambia automáticamente el estado de la orden.
  // El estado de cocina y el pago son conceptos independientes: una orden puede
  // estar pagada mientras sigue en preparación. El mesero/cajero cierra el estado
  // manualmente via PATCH /orders/:id/status cuando entrega al cliente.
  // ───────────────────────────────────────────────────────────────────────────

  return { pago, ordenPagada, totalOrden, totalPagado: nuevoTotalPagado, cambio,
    restante: ordenPagada ? 0 : parseFloat((restante - datos.monto).toFixed(2)) }
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

  if (!orden) throw new AppError(404, 'Orden no encontrada')

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

// ─── Helper: subir buffer a Cloudinary ───────────────────────────────────────
const subirACloudinary = (buffer: Buffer, folder: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err || !result) return reject(err ?? new Error('Error al subir imagen'))
      resolve(result.secure_url)
    })
    stream.end(buffer)
  })

// ─── Subir comprobante de pago ────────────────────────────────────────────────
export const subirComprobante = async (pagoId: number, buffer: Buffer) => {
  const pago = await prisma.pagos.findUnique({ where: { id: pagoId } })
  if (!pago) throw new AppError(404, 'Pago no encontrado')

  const url = await subirACloudinary(buffer, 'comprobantes')

  return await prisma.pagos.update({
    where: { id: pagoId },
    data:  { comprobante_url: url, confirmado: null },
    include: {
      metodos_pago: { select: { id: true, nombre: true } },
      ordenes:      { select: { id: true, numero: true, estado: true, total: true } },
    },
  })
}

// ─── Aprobar o rechazar comprobante ──────────────────────────────────────────
export const confirmarPago = async (
  pagoId:   number,
  aprobado: boolean,
  notas?:   string,
) => {
  const pago = await prisma.pagos.findUnique({
    where:   { id: pagoId },
    include: { ordenes: true },
  })
  if (!pago) throw new AppError(404, 'Pago no encontrado')
  if (!pago.comprobante_url) throw new AppError(400, 'Este pago no tiene comprobante adjunto')
  if (pago.confirmado !== null) {
    throw new AppError(400, `El comprobante ya fue ${pago.confirmado ? 'aprobado' : 'rechazado'}`)
  }

  if (aprobado) {
    // ── Aprobar: marcar pago y cerrar la orden ────────────────────────────────
    const [pagoActualizado] = await prisma.$transaction([
      prisma.pagos.update({
        where: { id: pagoId },
        data:  { confirmado: true, notas_confirmacion: notas ?? null },
        include: {
          metodos_pago: { select: { id: true, nombre: true } },
          ordenes:      { select: { id: true, numero: true, estado: true, total: true } },
        },
      }),
      prisma.ordenes.update({
        where: { id: pago.orden_id },
        data:  { estado: 'entregada', actualizado_en: new Date() },
      }),
    ])
    return pagoActualizado
  } else {
    // ── Rechazar: limpiar comprobante, orden permanece en su estado actual ────
    return await prisma.pagos.update({
      where: { id: pagoId },
      data:  { confirmado: false, notas_confirmacion: notas ?? null, comprobante_url: null },
      include: {
        metodos_pago: { select: { id: true, nombre: true } },
        ordenes:      { select: { id: true, numero: true, estado: true, total: true } },
      },
    })
  }
}

// ─── Transferencias pendientes de revisión ───────────────────────────────────
export const getPendingTransfers = async () => {
  return await prisma.pagos.findMany({
    where: {
      comprobante_url:    { not: null },
      confirmado:         null,
    },
    include: {
      metodos_pago: { select: { id: true, nombre: true } },
      ordenes: {
        select: {
          id:            true,
          numero:        true,
          estado:        true,
          total:         true,
          tipo_servicio: true,
          creado_en:     true,
          nombre_cliente: true,
        },
      },
    },
    orderBy: { pagado_en: 'asc' },
  })
}

// ─── Órdenes pendientes de pago ───────────────────────────────────────────────
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

  return ordenes
    .map((orden) => {
      const totalOrden  = toNum(orden.total)
      const totalPagado = orden.pagos.reduce((sum, p) => sum + toNum(p.monto), 0)
      const restante    = parseFloat(Math.max(0, totalOrden - totalPagado).toFixed(2))
      return { ...orden, totalPagado: parseFloat(totalPagado.toFixed(2)), restante, pagada: restante === 0 }
    })
    .filter((o) => !o.pagada)
}
