import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
export const ForgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

export const ResetPasswordSchema = z.object({
  token:    z.string().min(1, 'Token requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export const LoginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export const RolSchema = z.enum(
  ['gerente', 'cajero', 'cocinero', 'mesero', 'repartidor', 'cliente'],
  { message: 'Rol inválido' }
)

export const RegistrarSchema = z.object({
  email:      z.string().email('Email inválido'),
  password:   z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  // opcional: ausente en registro público (se fuerza a 'cliente' en el controller)
  rol:        RolSchema.optional(),
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
  tipoServicio:     z.enum(['mostrador', 'domicilio', 'evento']).default('mostrador'),
  productos:        z.array(ProductoOrdenSchema).optional(),
  combos:           z.array(ComboOrdenSchema).optional(),
  notas:            z.string().max(500).optional(),
  nombreCliente:    z.string().min(1).max(100).optional(),
  direccionEntrega: z.string().min(5).max(300).optional(),
  latitudEntrega:   z.number().min(-90).max(90).optional(),
  longitudEntrega:  z.number().min(-180).max(180).optional(),
  telefonoCliente:  z.string().min(7).max(20).optional(),
}).superRefine((data, ctx) => {
  if ((data.productos?.length ?? 0) + (data.combos?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La orden debe tener al menos un producto o combo',
    })
  }
  if (data.tipoServicio === 'domicilio') {
    if (!data.direccionEntrega) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['direccionEntrega'],
        message: 'La dirección de entrega es requerida para pedidos a domicilio',
      })
    }
    if (!data.telefonoCliente) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['telefonoCliente'],
        message: 'El teléfono del cliente es requerido para pedidos a domicilio',
      })
    }
  }
})

export const CambiarEstadoOrdenSchema = z.object({
  estado: z.enum(['pendiente', 'en_preparacion', 'lista', 'entregada', 'cancelada'], {
    message: 'Estado inválido',
  }),
})

export const ActualizarTiempoEstimadoSchema = z.object({
  // null permite limpiar el estimado cuando ya no aplica
  tiempoEstimadoMinutos: z
    .number()
    .int('Debe ser un número entero de minutos')
    .min(1,   'El tiempo mínimo es 1 minuto')
    .max(480, 'El tiempo máximo es 480 minutos (8 horas)')
    .nullable(),
})

export const AsignarRepartidorSchema = z.object({
  repartidorId: z.number().int().positive('repartidorId debe ser un entero positivo'),
})

// Cada item lleva su productoId/comboId + la cantidad deseada.
// cantidad > 0 → agregar si no existe, actualizar si ya existe.
// cantidad = 0 → eliminar (solo permitido en estado 'pendiente').
const ItemProductoEditSchema = z.object({
  productoId: z.number().int().positive('productoId debe ser un entero positivo'),
  cantidad:   z.number().int().min(0, 'La cantidad mínima es 0 (0 = eliminar)'),
  notas:      z.string().max(200).optional(),
})

const ItemComboEditSchema = z.object({
  comboId:  z.number().int().positive('comboId debe ser un entero positivo'),
  cantidad: z.number().int().min(0, 'La cantidad mínima es 0 (0 = eliminar)'),
})

export const ActualizarItemsOrdenSchema = z.object({
  productos: z.array(ItemProductoEditSchema).optional(),
  combos:    z.array(ItemComboEditSchema).optional(),
}).superRefine((data, ctx) => {
  if ((data.productos?.length ?? 0) + (data.combos?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Debes enviar al menos un item para modificar',
    })
  }
  // Prohibir productoId duplicado en la misma petición
  const pIds = data.productos?.map(p => p.productoId) ?? []
  if (new Set(pIds).size !== pIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['productos'],
      message: 'No se permiten productoId duplicados en la misma solicitud',
    })
  }
  // Prohibir comboId duplicado en la misma petición
  const cIds = data.combos?.map(c => c.comboId) ?? []
  if (new Set(cIds).size !== cIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['combos'],
      message: 'No se permiten comboId duplicados en la misma solicitud',
    })
  }
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

export const ConfirmarPagoSchema = z.object({
  aprobado: z.boolean({ message: 'El campo aprobado debe ser true o false' }),
  notas:    z.string().max(300).optional(),
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
// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────
const FechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido, usa YYYY-MM-DD')

export const CompararVentasSchema = z.object({
  periodo1Inicio: FechaSchema,
  periodo1Fin:    FechaSchema,
  periodo2Inicio: FechaSchema,
  periodo2Fin:    FechaSchema,
}).superRefine((data, ctx) => {
  if (data.periodo1Inicio > data.periodo1Fin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodo1Fin'],
      message: 'periodo1Fin debe ser mayor o igual a periodo1Inicio',
    })
  }
  if (data.periodo2Inicio > data.periodo2Fin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['periodo2Fin'],
      message: 'periodo2Fin debe ser mayor o igual a periodo2Inicio',
    })
  }
})

export const ReporteInventarioSchema = z.object({
  fechaInicio: FechaSchema.optional(),
  fechaFin:    FechaSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.fechaInicio && data.fechaFin && data.fechaInicio > data.fechaFin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fechaFin'],
      message: 'fechaFin debe ser mayor o igual a fechaInicio',
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
export const ActualizarUsuarioSchema = z.object({
  rol:        RolSchema.optional(),
  activo:     z.boolean().optional(),
  password:   z.string().min(6).optional(),
  empleadoId: z.number().int().positive().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar' }
)