import { prisma } from '../../config/db'
import { getServicioActivo } from '../services/services.service'

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

// ─── Crear orden ──────────────────────────────────────────────────────────────
export const crearOrden = async (datos: CrearOrdenDTO, usuarioId?: number) => {
  // 1. Verificar servicio activo
  const servicio = await getServicioActivo()
  if (!servicio) {
    throw new Error('No hay ningún servicio abierto')
  }

  // 2. Calcular subtotal
  let subtotal = 0

  // Calcular precio de productos
  if (datos.productos && datos.productos.length > 0) {
    const productosIds = datos.productos.map((p) => p.productoId)
    const productosDB = await prisma.productos.findMany({
      where: { id: { in: productosIds }, disponible: true }
    })

    for (const item of datos.productos) {
      const producto = productosDB.find((p) => p.id === item.productoId)
      if (!producto) {
        throw new Error(`Producto ${item.productoId} no disponible`)
      }
      subtotal += parseFloat(producto.precio_base.toString()) * item.cantidad
    }
  }

  // Calcular precio de combos
  if (datos.combos && datos.combos.length > 0) {
    const combosIds = datos.combos.map((c) => c.comboId)
    const combosDB = await prisma.combos.findMany({
      where: { id: { in: combosIds }, disponible: true }
    })

    for (const item of datos.combos) {
      const combo = combosDB.find((c) => c.id === item.comboId)
      if (!combo) {
        throw new Error(`Combo ${item.comboId} no disponible`)
      }
      subtotal += parseFloat(combo.precio.toString()) * item.cantidad
    }
  }

  if (subtotal === 0) {
    throw new Error('La orden debe tener al menos un producto o combo')
  }

  // 3. Crear la orden con sus detalles
  const orden = await prisma.ordenes.create({
    data: {
      servicio_id: servicio.id,
      nombre_cliente: datos.nombreCliente ?? null,
      notas_orden: datos.notas ?? null,
      subtotal,
      descuento: 0,
      estado: 'pendiente',
      // Crear detalles de productos
      orden_detalles: datos.productos && datos.productos.length > 0 ? {
        create: await Promise.all(datos.productos.map(async (item) => {
          const producto = await prisma.productos.findUnique({
            where: { id: item.productoId }
          })
          return {
            producto_id: item.productoId,
            cantidad: item.cantidad,
            precio_unitario: producto!.precio_base,
            notas_item: item.notas ?? null,
          }
        }))
      } : undefined,
      // Crear detalles de combos
      orden_combos: datos.combos && datos.combos.length > 0 ? {
        create: await Promise.all(datos.combos.map(async (item) => {
          const combo = await prisma.combos.findUnique({
            where: { id: item.comboId }
          })
          return {
            combo_id: item.comboId,
            cantidad: item.cantidad,
            precio_unitario: combo!.precio,
          }
        }))
      } : undefined,
    },
    include: {
      orden_detalles: {
        include: {
          productos: {
            select: { id: true, nombre: true, precio_base: true }
          }
        }
      },
      orden_combos: {
        include: {
          combos: {
            select: { id: true, nombre: true, precio: true }
          }
        }
      }
    }
  })

  // 4. Registrar en historial de estados
  await prisma.orden_estados_historial.create({
    data: {
      orden_id: orden.id,
      estado: 'pendiente',
      notas: 'Orden creada',
    }
  })

  return orden
}

// ─── Obtener órdenes activas ──────────────────────────────────────────────────
export const getOrdenes = async () => {
  return await prisma.ordenes.findMany({
    where: {
      estado: { not: 'cancelada' }
    },
    include: {
      orden_detalles: {
        include: {
          productos: {
            select: { id: true, nombre: true }
          }
        }
      },
      orden_combos: {
        include: {
          combos: {
            select: { id: true, nombre: true }
          }
        }
      }
    },
    orderBy: { creado_en: 'desc' }
  })
}

// ─── Obtener orden por ID ─────────────────────────────────────────────────────
export const getOrdenById = async (id: number) => {
  return await prisma.ordenes.findUnique({
    where: { id },
    include: {
      orden_detalles: {
        include: {
          productos: {
            select: { id: true, nombre: true, precio_base: true }
          }
        }
      },
      orden_combos: {
        include: {
          combos: {
            select: { id: true, nombre: true, precio: true }
          }
        }
      },
      orden_estados_historial: {
        orderBy: { registrado_en: 'asc' }
      }
    }
  })
}

// ─── Cambiar estado de la orden ───────────────────────────────────────────────
export const cambiarEstadoOrden = async (
  id: number,
  estado: string,
  empleadoId?: number
) => {
  const estadosValidos = ['pendiente', 'en_preparacion', 'lista', 'entregada', 'cancelada']

  if (!estadosValidos.includes(estado)) {
    throw new Error(`Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`)
  }

  const orden = await prisma.ordenes.findUnique({ where: { id } })
  if (!orden) {
    throw new Error('Orden no encontrada')
  }

  const ordenActualizada = await prisma.ordenes.update({
    where: { id },
    data: {
      estado,
      actualizado_en: new Date(),
    }
  })

  // Registrar en historial
  await prisma.orden_estados_historial.create({
    data: {
      orden_id: id,
      estado,
      empleado_id: empleadoId ?? null,
    }
  })

  return ordenActualizada
}