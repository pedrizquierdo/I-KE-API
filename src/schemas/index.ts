import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export const RegistrarSchema = z.object({
  email:      z.string().email('Email inválido'),
  password:   z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol:        z.enum(['gerente', 'cajero', 'cocinero', 'mesero'], {
    message: 'Rol inválido',
  }),
  empleadoId: z.number().int().positive().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────
const ProductoOrdenSchema = z.object({
  productoId: z.number().int().positive('productoId debe ser un entero positivo'),
  cantidad:   z.number().int().min(1, 'La cantidad mínima es 1'),
  notas:      z.string().max(200).optional(),
})

const ComboOrdenSchema = z.object({
  comboId:  z.number().int().positive('comboId debe ser un entero positivo'),
  cantidad: z.number().int().min(1, 'La cantidad mínima es 1'),
})

export const CrearOrdenSchema = z.object({
  productos:     z.array(ProductoOrdenSchema).optional(),
  combos:        z.array(ComboOrdenSchema).optional(),
  notas:         z.string().max(500).optional(),
  nombreCliente: z.string().min(1).max(100).optional(),
}).refine(
  (data) => (data.productos?.length ?? 0) + (data.combos?.length ?? 0) > 0,
  { message: 'La orden debe tener al menos un producto o combo' }
)

export const CambiarEstadoOrdenSchema = z.object({
  estado: z.enum(['pendiente', 'en_preparacion', 'lista', 'entregada', 'cancelada'], {
    message: 'Estado inválido',
  }),
})

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const ProcesarPagoSchema = z.object({
  ordenId:      z.number().int().positive('ordenId inválido'),
  metodoPagoId: z.number().int().positive('metodoPagoId inválido'),
  monto:        z.number().positive('El monto debe ser mayor a 0')
                 .max(99999.99, 'Monto fuera de rango'),
  referencia:   z.string().max(100).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// MENU ADMIN — Productos
// ─────────────────────────────────────────────────────────────────────────────
export const CrearProductoSchema = z.object({
  categoriaId:  z.number().int().positive(),
  nombre:       z.string().min(1).max(150),
  descripcion:  z.string().max(500).optional(),
  precioBase:   z.number().positive('El precio debe ser mayor a 0').max(9999.99),
  imagenUrl:    z.string().url('URL de imagen inválida').optional().or(z.literal('')),
})

export const ActualizarProductoSchema = z.object({
  categoriaId:  z.number().int().positive().optional(),
  nombre:       z.string().min(1).max(150).optional(),
  descripcion:  z.string().max(500).optional(),
  precioBase:   z.number().positive().max(9999.99).optional(),
  imagenUrl:    z.string().url().optional().or(z.literal('')),
  disponible:   z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar' }
)

// ─────────────────────────────────────────────────────────────────────────────
// MENU ADMIN — Categorías
// ─────────────────────────────────────────────────────────────────────────────
export const CrearCategoriaSchema = z.object({
  nombre:      z.string().min(1).max(100),
  descripcion: z.string().max(300).optional(),
})

export const ActualizarCategoriaSchema = z.object({
  nombre:      z.string().min(1).max(100).optional(),
  descripcion: z.string().max(300).optional(),
  activo:      z.boolean().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// MENU ADMIN — Combos
// ─────────────────────────────────────────────────────────────────────────────
const ComboItemSchema = z.object({
  productoId: z.number().int().positive(),
  cantidad:   z.number().int().min(1),
})

export const CrearComboSchema = z.object({
  nombre:      z.string().min(1).max(150),
  descripcion: z.string().max(500).optional(),
  precio:      z.number().positive().max(9999.99),
  imagenUrl:   z.string().url().optional().or(z.literal('')),
  items:       z.array(ComboItemSchema).min(1, 'El combo debe tener al menos un producto'),
})

export const ActualizarComboSchema = z.object({
  nombre:      z.string().min(1).max(150).optional(),
  descripcion: z.string().max(500).optional(),
  precio:      z.number().positive().max(9999.99).optional(),
  imagenUrl:   z.string().url().optional().or(z.literal('')),
  disponible:  z.boolean().optional(),
  items:       z.array(ComboItemSchema).min(1).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY — Ingredientes
// ─────────────────────────────────────────────────────────────────────────────
export const CrearIngredienteSchema = z.object({
  nombre:          z.string().min(1).max(150),
  unidadMedidaId:  z.number().int().positive(),
  stockActual:     z.number().min(0).optional(),
  stockMinimo:     z.number().min(0).optional(),
  stockMaximo:     z.number().min(0).optional(),
  costoUnitario:   z.number().min(0).optional(),
  proveedor:       z.string().max(150).optional(),
})

export const ActualizarIngredienteSchema = z.object({
  nombre:         z.string().min(1).max(150).optional(),
  unidadMedidaId: z.number().int().positive().optional(),
  stockMinimo:    z.number().min(0).optional(),
  stockMaximo:    z.number().min(0).optional(),
  costoUnitario:  z.number().min(0).optional(),
  proveedor:      z.string().max(150).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY — Movimientos
// ─────────────────────────────────────────────────────────────────────────────
export const RegistrarMovimientoSchema = z.object({
  ingredienteId: z.number().int().positive(),
  tipo:          z.enum(['entrada', 'ajuste', 'merma', 'caducidad'], {
    message: 'Tipo de movimiento inválido. Use: entrada, ajuste, merma o caducidad',
  }),
  cantidad:      z.number().positive('La cantidad debe ser mayor a 0'),
  motivo:        z.string().max(200).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY — Recetas
// ─────────────────────────────────────────────────────────────────────────────
export const CrearRecetaSchema = z.object({
  productoId:    z.number().int().positive(),
  ingredienteId: z.number().int().positive(),
  cantidad:      z.number().positive('La cantidad debe ser mayor a 0'),
})

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
export const ActualizarUsuarioSchema = z.object({
  rol:        z.enum(['gerente', 'cajero', 'cocinero', 'mesero']).optional(),
  activo:     z.boolean().optional(),
  password:   z.string().min(6).optional(),
  empleadoId: z.number().int().positive().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar' }
)