import { prisma } from '../../config/db'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CrearIngredienteDTO {
  nombre: string
  unidadMedidaId: number
  stockActual?: number
  stockMinimo?: number
  stockMaximo?: number
  costoUnitario?: number
  proveedor?: string
}

interface MovimientoDTO {
  ingredienteId: number
  tipo: 'entrada' | 'ajuste' | 'merma' | 'caducidad'
  cantidad: number
  motivo?: string
  empleadoId?: number
}

// ─── Ingredientes ─────────────────────────────────────────────────────────────
export const getIngredientes = async () => {
  return await prisma.ingredientes.findMany({
    where: { activo: true },
    include: {
      unidades_medida: { select: { id: true, nombre: true, simbolo: true } }
    },
    orderBy: { nombre: 'asc' }
  })
}

export const getAlertasStock = async () => {
  return await prisma.ingredientes.findMany({
    where: {
      activo: true,
      stock_actual: { lte: prisma.ingredientes.fields.stock_minimo }
    },
    include: {
      unidades_medida: { select: { simbolo: true } }
    },
    orderBy: { stock_actual: 'asc' }
  })
}

export const crearIngrediente = async (datos: CrearIngredienteDTO) => {
  const existe = await prisma.ingredientes.findUnique({
    where: { nombre: datos.nombre }
  })
  if (existe) throw new Error('Ya existe un ingrediente con ese nombre')

  return await prisma.ingredientes.create({
    data: {
      nombre: datos.nombre,
      unidad_medida_id: datos.unidadMedidaId,
      stock_actual: datos.stockActual ?? 0,
      stock_minimo: datos.stockMinimo ?? 0,
      stock_maximo: datos.stockMaximo ?? null,
      costo_unitario: datos.costoUnitario ?? null,
      proveedor: datos.proveedor ?? null,
    },
    include: {
      unidades_medida: { select: { id: true, nombre: true, simbolo: true } }
    }
  })
}

export const actualizarIngrediente = async (
  id: number,
  datos: Partial<CrearIngredienteDTO>
) => {
  const ingrediente = await prisma.ingredientes.findUnique({ where: { id } })
  if (!ingrediente) throw new Error('Ingrediente no encontrado')

  return await prisma.ingredientes.update({
    where: { id },
    data: {
      nombre: datos.nombre ?? undefined,
      unidad_medida_id: datos.unidadMedidaId ?? undefined,
      stock_minimo: datos.stockMinimo ?? undefined,
      stock_maximo: datos.stockMaximo ?? undefined,
      costo_unitario: datos.costoUnitario ?? undefined,
      proveedor: datos.proveedor ?? undefined,
    },
    include: {
      unidades_medida: { select: { id: true, nombre: true, simbolo: true } }
    }
  })
}

// ─── Movimientos de inventario ────────────────────────────────────────────────
export const registrarMovimiento = async (datos: MovimientoDTO) => {
  const ingrediente = await prisma.ingredientes.findUnique({
    where: { id: datos.ingredienteId }
  })
  if (!ingrediente) throw new Error('Ingrediente no encontrado')

  if (datos.cantidad <= 0) throw new Error('La cantidad debe ser mayor a 0')

  // Para merma y caducidad la cantidad es negativa
  const cantidadReal = ['merma', 'caducidad'].includes(datos.tipo)
    ? -Math.abs(datos.cantidad)
    : Math.abs(datos.cantidad)

  // Verificar que no quede stock negativo
  const nuevoStock = parseFloat(ingrediente.stock_actual.toString()) + cantidadReal
  if (nuevoStock < 0) {
    throw new Error(`Stock insuficiente. Stock actual: ${ingrediente.stock_actual}`)
  }

  // Registrar movimiento y actualizar stock en una transacción
  const [movimiento] = await prisma.$transaction([
    prisma.movimientos_inventario.create({
      data: {
        ingrediente_id: datos.ingredienteId,
        tipo: datos.tipo,
        cantidad: cantidadReal,
        empleado_id: datos.empleadoId ?? null,
        motivo: datos.motivo ?? null,
      }
    }),
    prisma.ingredientes.update({
      where: { id: datos.ingredienteId },
      data: { stock_actual: nuevoStock }
    })
  ])

  return movimiento
}

export const getMovimientos = async (ingredienteId?: number) => {
  return await prisma.movimientos_inventario.findMany({
    where: ingredienteId ? { ingrediente_id: ingredienteId } : undefined,
    include: {
      ingredientes: { select: { id: true, nombre: true } },
      empleados: { select: { id: true, nombre: true, apellido: true } }
    },
    orderBy: { creado_en: 'desc' },
    take: 100
  })
}

// ─── Unidades de medida ───────────────────────────────────────────────────────
export const getUnidadesMedida = async () => {
  return await prisma.unidades_medida.findMany({
    orderBy: { nombre: 'asc' }
  })
}

// ─── Recetas ──────────────────────────────────────────────────────────────────
export const getRecetasByProducto = async (productoId: number) => {
  return await prisma.recetas.findMany({
    where: { producto_id: productoId },
    include: {
      ingredientes: {
        include: {
          unidades_medida: { select: { simbolo: true } }
        }
      }
    }
  })
}

export const crearReceta = async (
  productoId: number,
  ingredienteId: number,
  cantidad: number
) => {
  const existe = await prisma.recetas.findUnique({
    where: { producto_id_ingrediente_id: { producto_id: productoId, ingrediente_id: ingredienteId } }
  })
  if (existe) throw new Error('Ya existe esa relación en la receta')

  return await prisma.recetas.create({
    data: { producto_id: productoId, ingrediente_id: ingredienteId, cantidad }
  })
}