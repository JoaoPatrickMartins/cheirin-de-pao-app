/**
 * Textos das páginas públicas (/privacidade, /termos, /exclusao-de-dados) — handoff L9.
 *
 * ⚠️ RASCUNHO para revisão jurídica (D-5 do plano-login-social.md). Descreve o que o app faz de
 * verdade hoje, mas NÃO é texto aprovado. Enquanto `LEGAL_DRAFT` for true, as páginas mostram o aviso
 * "Versão provisória". Ao aprovar: ajustar o texto, preencher razão social/CNPJ/encarregado, trocar
 * `LEGAL_UPDATED_AT` e desligar `LEGAL_DRAFT`.
 */

export const LEGAL_DRAFT = true
export const LEGAL_UPDATED_AT = '30/09/2026'
export const LEGAL_CONTACT_EMAIL = 'cheirindepao.contato@gmail.com'
// Prazo para concluir a exclusão (placeholder do handoff — confirmar com o jurídico).
export const DELETION_DAYS = 15

export interface LegalSection {
  title: string
  paragraphs: string[]
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Quem somos',
    paragraphs: [
      // TODO(jurídico): razão social, CNPJ e endereço do controlador.
      'O Cheirin de Pão entrega pão fresco em condomínios parceiros. Esta política explica quais dados pessoais tratamos, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
    ],
  },
  {
    title: 'Quais dados guardamos',
    paragraphs: [
      'Cadastro: nome, CPF, data de nascimento, celular, e-mail e endereço de entrega (condomínio, bloco, complemento e apartamento).',
      'Uso do app: pedidos, agenda de entregas, saldo e histórico de pãezins, pagamentos e registros de entrega.',
      'Entrar com o Google: recebemos do Google só o identificador da sua conta, o seu nome e o seu e-mail. Não recebemos sua senha do Google nem acesso a outros dados da sua conta.',
      'Aparelho: um identificador do aparelho para manter sua sessão segura e, se você permitir, o registro para notificações.',
    ],
  },
  {
    title: 'Para que usamos',
    paragraphs: [
      'Para criar e proteger sua conta, entregar o pão na sua porta, processar pagamentos, emitir comprovantes, avisar sobre suas entregas e dar suporte.',
      'Não vendemos seus dados a ninguém e não usamos seus dados para publicidade de terceiros.',
    ],
  },
  {
    title: 'Com quem compartilhamos',
    paragraphs: [
      'Só o necessário para o serviço funcionar: meios de pagamento (Mercado Pago e Stripe), envio de e-mails (Resend), notificações (OneSignal), login com o Google e a infraestrutura onde o app roda.',
      'O entregador vê apenas o que precisa para entregar: nome, bloco e apartamento.',
      'Também compartilhamos quando a lei exigir, com autoridades competentes.',
    ],
  },
  {
    title: 'Por quanto tempo',
    paragraphs: [
      'Mantemos seus dados enquanto sua conta existir. Depois da exclusão, guardamos só o que a lei obriga (por exemplo, registros fiscais e de pagamento) pelo prazo legal.',
    ],
  },
  {
    title: 'Seus direitos',
    paragraphs: [
      'Você pode pedir para confirmar, ver, corrigir, levar para outro serviço ou excluir seus dados, e revogar consentimentos, a qualquer momento. Veja como pedir a exclusão em "Exclusão de dados".',
      'Você também pode desconectar o Google da sua conta em Perfil › Minha conta, quando quiser.',
    ],
  },
]

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Sobre o Cheirin de Pão',
    paragraphs: [
      'O Cheirin de Pão entrega pão fresco em condomínios parceiros. Os pedidos são pagos com pãezins (créditos comprados no app) ou avulsos, conforme as regras mostradas no app.',
    ],
  },
  {
    title: 'Sua conta',
    paragraphs: [
      'A conta é pessoal e intransferível. Você pode entrar com e-mail e senha, com um código no e-mail ou com o Google. Mantenha seus dados de contato e de endereço atualizados.',
      'Você é responsável pelo que for feito com a sua conta. Se perceber algo estranho, fale com o suporte.',
    ],
  },
  {
    title: 'Pedidos e pãezins',
    paragraphs: [
      'Os pãezins comprados valem conforme as regras de cada combo. Pedidos e agenda podem ser alterados até o horário de corte informado no app.',
      'A entrega acontece no gancho da sua porta, no horário escolhido, nos condomínios atendidos.',
    ],
  },
  {
    title: 'Cancelamento',
    paragraphs: ['Você pode encerrar sua conta quando quiser, pelo suporte. Veja também "Exclusão de dados".'],
  },
]

export const DELETION_INTRO =
  'Você pode pedir a exclusão da sua conta e dos seus dados a qualquer momento — inclusive se entrou com o Google.'

export const DELETION_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: 'chat', title: 'Fale com o suporte pelo WhatsApp', text: 'Diga que quer excluir sua conta e seus dados.' },
  { icon: 'shield', title: 'Confirmamos que é você', text: 'Mandamos um código para o e-mail da conta.' },
  {
    icon: 'check',
    title: `Pronto em até ${DELETION_DAYS} dias`,
    text: 'Avisamos por e-mail quando terminar. Dados fiscais ficam guardados pelo prazo da lei.',
  },
]
