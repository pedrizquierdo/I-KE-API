import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

// ─── Transporter ──────────────────────────────────────────────────────────────
// Puerto 465 con SSL (secure: true) + family: 4 fuerza IPv4.
// Railway no tiene salida IPv6 nativa; sin family:4 Gmail resuelve a IPv6 y
// el socket falla con ENETUNREACH. `family` es una opción de net.createConnection
// que nodemailer pasa al TCP layer pero que @types/nodemailer no declara — de ahí
// la intersección de tipos para que TypeScript no la rechace como excess property.
const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   465,
  secure: true,  // SSL en puerto 465
  family: 4,     // fuerza IPv4 — crítico en Railway
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
} as SMTPTransport.Options & { family: number })

// ─── Enviar email de recuperación de contraseña ───────────────────────────────
export const sendResetEmail = async (email: string, resetUrl: string) => {
  await transporter.sendMail({
    from:    `"I KE TACOS BIRRIA" <${process.env.GMAIL_USER}>`,
    to:      email,
    subject: 'Recupera tu contraseña — I KE TACOS',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #F28500;">I KE TACOS BIRRIA</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz click en el siguiente botón para continuar:</p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #F28500; color: white;
                  padding: 12px 24px; border-radius: 8px; text-decoration: none;
                  font-weight: bold; margin: 16px 0;">
          Restablecer contraseña
        </a>
        <p style="color: #666; font-size: 12px;">
          Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
        </p>
        <p style="color: #666; font-size: 12px;">
          O copia este enlace: ${resetUrl}
        </p>
      </div>
    `,
  })
}

// Alias para compatibilidad con auth.service.ts
export const enviarEmailResetPassword = sendResetEmail
