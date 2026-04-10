import nodemailer from 'nodemailer'
import { env } from '../config/env'

// Transporter reutilizable — se configura una sola vez al arrancar el servidor
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true solo para puerto 465 (SSL), false para STARTTLS (587)
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
})

// ─── Plantillas ───────────────────────────────────────────────────────────────
export const enviarEmailResetPassword = async (
  destinatario: string,
  resetUrl: string
) => {
  await transporter.sendMail({
    from: `"I KE APP" <${env.SMTP_FROM}>`,
    to: destinatario,
    subject: 'Recuperación de contraseña — I KE APP',
    text: `Recibiste este correo porque solicitaste restablecer tu contraseña.\n\nHaz clic en el siguiente enlace (válido por 1 hora):\n${resetUrl}\n\nSi no solicitaste esto, ignora este mensaje.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1f2937;margin-bottom:8px">Recuperación de contraseña</h2>
        <p style="color:#6b7280;margin-bottom:24px">
          Recibiste este correo porque solicitaste restablecer tu contraseña.
          El enlace es válido por <strong>1 hora</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Restablecer contraseña
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">
          Si no solicitaste esto, puedes ignorar este mensaje.<br>
          Por seguridad, nunca compartas este enlace.
        </p>
      </div>
    `,
  })
}
