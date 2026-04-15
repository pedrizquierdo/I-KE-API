import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_SECRET_REFRESH: z.string().min(32, 'JWT_SECRET_REFRESH debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME es requerida'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY es requerida'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET es requerida'),
  // Gmail / nodemailer
  GMAIL_USER:          z.string().email('GMAIL_USER debe ser un email válido'),
  GMAIL_APP_PASSWORD:  z.string().min(1, 'GMAIL_APP_PASSWORD es requerida'),
  APP_URL:             z.string().url().optional(),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Variables de entorno inválidas:')
  result.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  })
  process.exit(1)
}

export const env = result.data
