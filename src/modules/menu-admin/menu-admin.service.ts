import { prisma } from '../../config/db'
import { AppError } from '../../lib/AppError'
import { cloudinary } from '../../config/cloudinary'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CrearProductoDTO {
  categoriaId: number
  nombre: string
  descripcion?: string
  precioBase: number
  imagenUrl?: string
}

interface ActualizarProductoDTO {
  nombre?: string
  descripcion?: string
  precioBase?: number
  disponible?: boolean
  imagenUrl?: string
  categoriaId?: number
}

interface CrearComboDTO {
  nombre: string
  descripcion?: string
  precio: number
  imagenUrl?: string
  items: { productoId: number; cantidad: number }[]
}

interface ActualizarComboDTO {
  nombre?: string
  descripcion?: string
  precio?: number
  disponible?: boolean
  imagenUrl?: string
}

// ─── Consultas admin (incluyen inactivos) ────────────────────────────────────
export const getAllProductos = async () => {
  return await prisma.productos.findMany({
    include: {
      categorias: { select: { id: true, nombre: true } }
    },
    orderBy: [
      { disponible: 'desc' }, // activos primero
      { nombre: 'asc' },
    ]
  })
}

export const getAllCombos = async () => {
  return await prisma.combos.findMany({
    include: {
      combo_items: {
        include: {
          productos: { select: { id: true, nombre: true, precio_base: true } }
        }
      }
    },
    orderBy: [
      { disponible: 'desc' },
      { nombre: 'asc' },
    ]
  })
}

// ─── Productos ────────────────────────────────────────────────────────────────
export const crearProducto = async (datos: CrearProductoDTO) => {
  const existe = await prisma.productos.findFirst({
    where: { nombre: datos.nombre, categoria_id: datos.categoriaId }
  })
  if (existe) throw new AppError(409, 'Ya existe un producto con ese nombre en esta categoría')

  return await prisma.productos.create({
    data: {
      categoria_id: datos.categoriaId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      precio_base: datos.precioBase,
      imagen_url: datos.imagenUrl ?? null,
    },
    include: {
      categorias: { select: { id: true, nombre: true } }
    }
  })
}

export const actualizarProducto = async (id: number, datos: ActualizarProductoDTO) => {
  const producto = await prisma.productos.findUnique({ where: { id } })
  if (!producto) throw new AppError(404, 'Producto no encontrado')

  return await prisma.productos.update({
    where: { id },
    data: {
      nombre: datos.nombre ?? undefined,
      descripcion: datos.descripcion ?? undefined,
      precio_base: datos.precioBase ?? undefined,
      disponible: datos.disponible ?? undefined,
      imagen_url: datos.imagenUrl ?? undefined,
      categoria_id: datos.categoriaId ?? undefined,
    },
    include: {
      categorias: { select: { id: true, nombre: true } }
    }
  })
}

export const subirImagenProducto = async (id: number, buffer: Buffer): Promise<string> => {
  const producto = await prisma.productos.findUnique({ where: { id } })
  if (!producto) throw new AppError(404, 'Producto no encontrado')

  const imageUrl = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'productos', resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(new AppError(500, 'Error al subir imagen a Cloudinary'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })

  await prisma.productos.update({
    where: { id },
    data: { imagen_url: imageUrl },
  })

  return imageUrl
}

export const eliminarProducto = async (id: number) => {
  const producto = await prisma.productos.findUnique({ where: { id } })
  if (!producto) throw new AppError(404, 'Producto no encontrado')

  return await prisma.productos.update({
    where: { id },
    data: { disponible: false },
    select: { id: true, nombre: true, disponible: true }
  })
}

// ─── Promociones ──────────────────────────────────────────────────────────────
interface CrearPromocionDTO {
  nombre: string
  descripcion?: string | null
  tipoDescuento: 'porcentaje' | 'monto_fijo'
  valor: number
  comboId?: number | null
  soloDia?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
  activo?: boolean
}

export const getAllPromociones = async () => {
  return await prisma.promociones.findMany({
    include: {
      combos: { select: { id: true, nombre: true, precio: true, imagen_url: true } },
    },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })
}

export const crearPromocion = async (datos: CrearPromocionDTO) => {
  return await prisma.promociones.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      tipo_descuento: datos.tipoDescuento,
      valor: datos.valor,
      combo_id: datos.comboId ?? null,
      solo_dia: datos.soloDia ?? null,
      fecha_inicio: datos.fechaInicio ? new Date(datos.fechaInicio) : null,
      fecha_fin: datos.fechaFin ? new Date(datos.fechaFin) : null,
      activo: datos.activo ?? true,
    },
    include: {
      combos: { select: { id: true, nombre: true, precio: true, imagen_url: true } },
    },
  })
}

export const actualizarPromocion = async (id: number, datos: Partial<CrearPromocionDTO>) => {
  const existe = await prisma.promociones.findUnique({ where: { id } })
  if (!existe) throw new AppError(404, 'Promoción no encontrada')

  return await prisma.promociones.update({
    where: { id },
    data: {
      nombre:         datos.nombre        ?? undefined,
      descripcion:    'descripcion'  in datos ? datos.descripcion  : undefined,
      tipo_descuento: datos.tipoDescuento  ?? undefined,
      valor:          datos.valor          ?? undefined,
      combo_id:       'comboId'      in datos ? datos.comboId      : undefined,
      solo_dia:       'soloDia'      in datos ? datos.soloDia      : undefined,
      fecha_inicio:   'fechaInicio'  in datos
        ? (datos.fechaInicio ? new Date(datos.fechaInicio) : null)
        : undefined,
      fecha_fin:      'fechaFin'     in datos
        ? (datos.fechaFin ? new Date(datos.fechaFin) : null)
        : undefined,
      activo:         datos.activo        ?? undefined,
    },
    include: {
      combos: { select: { id: true, nombre: true, precio: true, imagen_url: true } },
    },
  })
}

export const eliminarPromocion = async (id: number) => {
  const existe = await prisma.promociones.findUnique({ where: { id } })
  if (!existe) throw new AppError(404, 'Promoción no encontrada')

  return await prisma.promociones.update({
    where: { id },
    data: { activo: false },
    select: { id: true, nombre: true, activo: true },
  })
}

// ─── Categorías ───────────────────────────────────────────────────────────────
export const crearCategoria = async (nombre: string, descripcion?: string) => {
  const existe = await prisma.categorias.findUnique({ where: { nombre } })
  if (existe) throw new AppError(409, 'Ya existe una categoría con ese nombre')

  return await prisma.categorias.create({
    data: { nombre, descripcion: descripcion ?? null }
  })
}

export const actualizarCategoria = async (
  id: number,
  datos: { nombre?: string; descripcion?: string; activo?: boolean }
) => {
  const categoria = await prisma.categorias.findUnique({ where: { id } })
  if (!categoria) throw new AppError(404, 'Categoría no encontrada')

  return await prisma.categorias.update({
    where: { id },
    data: {
      nombre: datos.nombre ?? undefined,
      descripcion: datos.descripcion ?? undefined,
      activo: datos.activo ?? undefined,
    }
  })
}

// ─── Combos ───────────────────────────────────────────────────────────────────
export const crearCombo = async (datos: CrearComboDTO) => {
  const existe = await prisma.combos.findFirst({ where: { nombre: datos.nombre } })
  if (existe) throw new AppError(409, 'Ya existe un combo con ese nombre')

  return await prisma.combos.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      precio: datos.precio,
      imagen_url: datos.imagenUrl ?? null,
      combo_items: {
        create: datos.items.map((item) => ({
          producto_id: item.productoId,
          cantidad: item.cantidad,
        }))
      }
    },
    include: {
      combo_items: {
        include: {
          productos: { select: { id: true, nombre: true, precio_base: true } }
        }
      }
    }
  })
}

export const actualizarCombo = async (id: number, datos: ActualizarComboDTO) => {
  const combo = await prisma.combos.findUnique({ where: { id } })
  if (!combo) throw new AppError(404, 'Combo no encontrado')

  return await prisma.combos.update({
    where: { id },
    data: {
      nombre: datos.nombre ?? undefined,
      descripcion: datos.descripcion ?? undefined,
      precio: datos.precio ?? undefined,
      disponible: datos.disponible ?? undefined,
      imagen_url: datos.imagenUrl ?? undefined,
    },
    include: {
      combo_items: {
        include: {
          productos: { select: { id: true, nombre: true } }
        }
      }
    }
  })
}

export const eliminarCombo = async (id: number) => {
  const combo = await prisma.combos.findUnique({ where: { id } })
  if (!combo) throw new AppError(404, 'Combo no encontrado')

  return await prisma.combos.update({
    where: { id },
    data: { disponible: false },
    select: { id: true, nombre: true, disponible: true }
  })
}
