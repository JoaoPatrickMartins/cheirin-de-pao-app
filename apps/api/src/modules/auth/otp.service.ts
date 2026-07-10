import { Resend } from 'resend'
import { OTP_LOGO_PNG_BASE64 } from './otp-logo.asset.js'

const LOGO_CONTENT_ID = 'brand-logo'

function buildOtpEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Seu código de acesso — Cheirin de Pão</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;700&amp;family=Hanken+Grotesk:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
  body,table,td,a{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table,td{ mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img{ -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body{ margin:0; padding:0; width:100% !important; height:100% !important; }
  a{ color:#B0702A; }
  @media only screen and (max-width:600px){
    .container{ width:100% !important; }
    .px{ padding-left:24px !important; padding-right:24px !important; }
    .code-cell{ font-size:40px !important; letter-spacing:12px !important; }
  }
</style>
</head>

<body style="margin:0; padding:0; background-color:#0E0703; font-family:'Hanken Grotesk', Arial, Helvetica, sans-serif;">

  <!-- Preheader (hidden) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px; color:#0E0703;">
    Seu código de acesso do Cheirin de Pão chegou. Válido por 10 minutos.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0E0703;">
    <tbody><tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" class="container" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px; max-width:480px; background-color:#FBF3E4; border-radius:24px; overflow:hidden; box-shadow:0 18px 50px -12px rgba(0,0,0,.55);">

          <!-- Header / brand band (iluminação atrás da logo) -->
          <tbody><tr>
            <td align="center" style="background-color:#1E1207; background-image:radial-gradient(ellipse at 50% -10%, rgba(227,172,63,0.20), rgba(30,18,7,0) 62%); padding:36px 24px 30px 24px; border-radius:24px 24px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tbody><tr>
                  <td align="center">
                    <img src="cid:${LOGO_CONTENT_ID}" alt="Cheirin de Pão" width="76" height="76" style="display:block; width:76px; height:76px; border-radius:22px;">
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px; font-family:'Bricolage Grotesque', 'Trebuchet MS', 'Segoe UI', Arial, sans-serif; font-weight:700; font-size:24px; letter-spacing:-0.02em; color:#FBF3E4;">
                    Cheirin de Pão
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:6px; font-family:'Hanken Grotesk', Arial, sans-serif; font-weight:700; font-size:11px; letter-spacing:0.24em; color:#E3AC3F; text-transform:uppercase;">
                    Pão fresco na porta
                  </td>
                </tr>
              </tbody></table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="px" style="padding:36px 40px 8px 40px;">
              <p style="margin:0 0 10px 0; font-family:'Bricolage Grotesque', serif; font-weight:700; font-size:22px; line-height:1.25; color:#241608;">
                Seu código de acesso
              </p>
              <p style="margin:0; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:15px; line-height:1.6; color:#5A4426;">
                Olá! Use o código abaixo para entrar na sua conta. Ele é pessoal — não compartilhe com ninguém.
              </p>
            </td>
          </tr>

          <!-- OTP code -->
          <tr>
            <td class="px" style="padding:24px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF; border-radius:18px; border:1px solid #EFE0C4;">
                <tbody><tr>
                  <td align="center" class="code-cell" style="padding:26px 16px; font-family:'Bricolage Grotesque', 'Times New Roman', serif; font-weight:700; font-size:46px; letter-spacing:14px; color:#1E1207; line-height:1;">
                    ${code}
                  </td>
                </tr>
              </tbody></table>
            </td>
          </tr>

          <!-- Validity -->
          <tr>
            <td class="px" align="center" style="padding:14px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tbody><tr>
                  <td style="font-family:'Hanken Grotesk', Arial, sans-serif; font-size:13px; font-weight:600; color:#B0702A; padding:6px 14px; background-color:#F6E9CE; border-radius:999px;">
                    ⏱ Válido por 10 minutos
                  </td>
                </tr>
              </tbody></table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td class="px" style="padding:28px 40px 36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tbody><tr><td style="border-top:1px solid #EADCC0; font-size:0; line-height:0;">&nbsp;</td></tr>
              </tbody></table>
              <p style="margin:20px 0 0 0; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:13px; line-height:1.6; color:#8A6F49;">
                Se você não solicitou este código, pode ignorar este e-mail com segurança. Nenhuma ação será tomada na sua conta.
              </p>
            </td>
          </tr>

        </tbody></table>

        <!-- Footer -->
        <table role="presentation" class="container" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px; max-width:480px;">
          <tbody><tr>
            <td align="center" style="padding:24px 24px 8px 24px;">
              <p style="margin:0; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:12px; line-height:1.6; color:#8B7A63;">
                Cheirin de Pão · Pão artesanal entregue quentinho<br>
                Este é um e-mail automático — por favor, não responda.
              </p>
              <p style="margin:10px 0 0 0; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:12px; color:#6E5F4C;">
                <a href="#" style="color:#B0702A; text-decoration:none;">Ajuda</a>
                &nbsp;·&nbsp;
                <a href="#" style="color:#B0702A; text-decoration:none;">Privacidade</a>
              </p>
            </td>
          </tr>
        </tbody></table>

      </td>
    </tr>
  </tbody></table>

</body></html>`
}

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM are required')

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'Seu código de acesso — Cheirin de Pão',
    html: buildOtpEmailHtml(code),
    attachments: [
      {
        // Inline (cid:) attachment — renders in Gmail/Outlook, unlike inline <svg> or data: URIs
        filename: 'cheirin-de-pao.png',
        content: Buffer.from(OTP_LOGO_PNG_BASE64, 'base64'),
        contentId: LOGO_CONTENT_ID,
        contentType: 'image/png',
      },
    ],
  })

  if (error) throw new Error(`Resend email error: ${error.message}`)
}
