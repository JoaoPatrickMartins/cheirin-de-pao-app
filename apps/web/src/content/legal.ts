/**
 * Textos das páginas públicas (/privacidade, /termos, /exclusao-de-dados) — handoff L9.
 *
 * Publicado SEM o aviso "Versão provisória" por decisão do usuário (30/09/2026), antes da revisão
 * jurídica. Descreve o que o app faz de verdade hoje. Pendente: revisão jurídica, razão social/CNPJ/
 * encarregado e o prazo de exclusão. Ao mudar o texto, atualizar `LEGAL_UPDATED_AT`. Para voltar a
 * mostrar o aviso enquanto revisa, `LEGAL_DRAFT = true`.
 *
 * App do entregador (plano-app-entregador.md, Onda 9 — 02/10/2026): foto da entrega (privada, 90
 * dias — `PROOF_RETENTION_DAYS`), recados prontos com opt-out e a seção do entregador (localização
 * só durante a rota, só a última posição, apagada ao encerrar — `lib/courier-position-cleanup.ts`).
 */

export const LEGAL_DRAFT = false
export const LEGAL_UPDATED_AT = '02/10/2026'
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
      'Entrega: o horário e a situação de cada entrega e, quando houver, a foto que comprova a entrega (veja "Foto da entrega").',
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
      'O entregador vê apenas o que precisa para entregar: nome, bloco e apartamento. Ele nunca vê o seu telefone nem o seu e-mail.',
      'Também compartilhamos quando a lei exigir, com autoridades competentes.',
    ],
  },
  {
    title: 'Foto da entrega',
    paragraphs: [
      'Para comprovar a entrega, o entregador pode fotografar o pedido deixado na sua porta. Quando não consegue entregar, ele pode fotografar a porta ou a portaria, para mostrar que esteve lá.',
      'A foto fica guardada de forma privada, sem endereço público na internet. Depois de enviada, só você e a nossa equipe podem vê-la, por um link que vale poucos minutos.',
      'Apagamos a foto 90 dias depois da entrega. Depois disso, o app mostra "foto expirada".',
    ],
  },
  {
    title: 'Recados do entregador',
    paragraphs: [
      'Durante a entrega, o entregador pode mandar um recado pronto, como "Estou na portaria" ou "Deixei com o porteiro". Ele não escreve texto livre: escolhe um dos modelos do app, e cada recado só pode ser enviado uma vez por dia.',
      'O recado chega como notificação no app. O entregador não vê o seu telefone, e você não vê o dele.',
      'Se preferir não receber recados, desligue em Perfil › Notificações › Recados do entregador.',
    ],
  },
  {
    title: 'Se você é entregador',
    paragraphs: [
      'Cadastro: nome, CPF, celular, e-mail, foto, veículo e consumo, escala, folgas e forma de pagamento. Usamos esses dados para montar as rotas, emitir o seu crachá digital e calcular os seus pagamentos.',
      'Quando o pedido sai para entrega, o cliente vê só o seu primeiro nome e a sua foto. Na portaria, você mostra o crachá digital com nome, foto, número, CPF com parte escondida e validade.',
      'Localização: só depois que você toca em "Iniciar rota", e enquanto o app está aberto, o app envia a sua posição para a operação acompanhar as entregas. Guardamos só a última posição (e o ponto de partida, se você sair pelo GPS), nunca o caminho que você fez, e apagamos quando a rota termina. Fora da rota, o app não usa a sua localização. Os clientes não veem onde você está.',
      'Ao tocar em "Navegar", o endereço do prédio é aberto no app de mapas que você escolher (Google Maps, Waze ou Apple Maps), conforme as regras desse app.',
      'As fotos que você envia (comprovantes de entrega e ocorrências) ficam privadas e são apagadas em 90 dias.',
    ],
  },
  {
    title: 'Por quanto tempo',
    paragraphs: [
      'Mantemos seus dados enquanto sua conta existir. Depois da exclusão, guardamos só o que a lei obriga (por exemplo, registros fiscais e de pagamento) pelo prazo legal.',
      'Fotos de entrega e de ocorrências: 90 dias. Localização do entregador: só enquanto a rota está em andamento.',
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
      'Para comprovar a entrega, o entregador pode fotografar o pedido deixado na sua porta. Veja como cuidamos dessa foto na Política de Privacidade.',
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
