import { Resend } from 'resend'
import { env } from '../config/env'

const resend = new Resend(env.RESEND_API_KEY)

// ─── Enviar email de recuperación de contraseña ───────────────────────────────
export const sendResetEmail = async (email: string, resetUrl: string) => {
  await resend.emails.send({
    from:    'I KE TACOS BIRRIA <noreply@iketacos.com>',
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
