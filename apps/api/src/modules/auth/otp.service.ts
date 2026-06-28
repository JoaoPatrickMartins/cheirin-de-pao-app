import { Resend } from 'resend'

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM are required')

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'Seu código de acesso - Cheirin de Pão',
    html: `<p>Seu código de acesso é: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
  })

  if (error) throw new Error(`Resend email error: ${error.message}`)
}
