import { Resend } from 'resend'

export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const token = process.env.ZENVIA_TOKEN
  const from = process.env.ZENVIA_FROM
  if (!token || !from) throw new Error('ZENVIA_TOKEN and ZENVIA_FROM are required')

  const res = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-TOKEN': token },
    body: JSON.stringify({
      from,
      to: phone,
      contents: [{ type: 'text', text: `Seu código Cheirin de Pão: ${code}` }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Zenvia SMS error ${res.status}: ${body}`)
  }
}

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
