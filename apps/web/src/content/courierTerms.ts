import { LEGAL_DOCS } from '@cheirin-de-pao/shared'
import { DELETION_DAYS, LEGAL_CONTACT_EMAIL, type LegalSection } from './legal'

/**
 * Termo do Entregador Parceiro (plano-termos-legais §4). Aparece em `/termos-entregador`, no
 * bloqueio de aceite do app do entregador (`TermsGate`) e no Perfil.
 *
 * RASCUNHO OPERACIONAL publicado sem revisão jurídica por decisão do usuário (D-T3, 05/10/2026). A
 * revisão vira uma VERSÃO NOVA: mude `LEGAL_DOCS.COURIER_TERMS.version` no shared e o app pede o
 * aceite de novo. Pendências para o advogado na §4 do plano (razão social/CNPJ, prazo de pagamento,
 * foro, motofrete, seguro, pessoalidade).
 *
 * Regra do texto: NÃO prometer o que o app não faz (ex.: o trajeto — reordenar depende de permissão;
 * a escala é combinada com a operação).
 */

export const COURIER_TERMS = LEGAL_DOCS.COURIER_TERMS
/** "05/10/2026" */
export const COURIER_TERMS_DATE = COURIER_TERMS.date.split('-').reverse().join('/')

export const COURIER_TERMS_INTRO =
  'Este termo explica como funciona a parceria entre você, entregador, e o Cheirin de Pão. Leia com calma: para usar o app de entregas, você precisa aceitá-lo.'

export const COURIER_TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. O que é este termo',
    paragraphs: [
      // TODO(jurídico): razão social, CNPJ e endereço da empresa.
      'O Cheirin de Pão entrega pão fresco em condomínios parceiros. Você presta o serviço de entrega de forma autônoma, usando o app do entregador.',
      `Ao tocar em "Aceitar" no app, você concorda com esta versão (${COURIER_TERMS.version}, de ${COURIER_TERMS_DATE}). Guardamos a data, a versão e o aparelho do seu aceite.`,
    ],
  },
  {
    title: '2. Não há vínculo de emprego',
    paragraphs: [
      'A parceria não cria vínculo empregatício entre você e o Cheirin de Pão. Você não é nosso empregado: presta um serviço por conta própria, com autonomia.',
      'Não há exclusividade. Você pode trabalhar para outras empresas e aplicativos, inclusive do mesmo ramo, quando quiser.',
      'Você só trabalha nos turnos que aceitar. Fora deles, não há horário a cumprir nem obrigação de ficar disponível.',
    ],
  },
  {
    title: '3. Turnos: você aceita ou recusa',
    paragraphs: [
      'A operação oferece os turnos pelo app, de acordo com a disponibilidade combinada com você. Cada turno chega com as paradas do dia e os botões "Aceitar" e "Recusar".',
      'Você pode recusar qualquer turno, sem precisar explicar. Recusar não gera penalidade: não muda seu pagamento, as próximas ofertas nem nenhuma avaliação. As entregas recusadas vão para outra pessoa.',
      'Se você não responder, o turno fica com você. Dá para recusar até iniciar a rota. Depois disso, fale com a operação.',
    ],
  },
  {
    title: '4. Cadastro e requisitos',
    paragraphs: [
      'Você informa dados verdadeiros e os mantém atualizados. Para entregar de moto ou de carro, mantém a CNH e os documentos do veículo em dia.',
      'O celular, a internet e o veículo usados nas entregas são seus.',
    ],
  },
  {
    title: '5. Como a entrega é feita',
    paragraphs: [
      'O serviço combinado é o resultado: o pedido certo no gancho da porta do cliente, no turno aceito. Para isso, você confirma cada entrega no app, tira a foto do comprovante quando a operação pedir e informa o motivo quando não conseguir entregar.',
      'O app sugere a ordem das paradas e mostra o caminho; o seu jeito de chegar até cada prédio é com você, respeitando as regras de cada condomínio.',
    ],
  },
  {
    title: '6. Pagamento',
    paragraphs: [
      'Você recebe pela forma combinada no seu cadastro (por entrega, por rota ou um valor semanal), mais o combustível, quando combinado. A semana vai de segunda a domingo; a operação revisa a proposta da semana e paga pelo meio combinado.',
      'Impostos e contribuições sobre o que você recebe são de sua responsabilidade, como em qualquer serviço autônomo.',
      'Nenhum valor é descontado do seu pagamento sem acordo com você.',
    ],
  },
  {
    title: '7. Custos e equipamentos',
    paragraphs: [
      'Manutenção do veículo, multas, celular e internet são por sua conta.',
      'Quando combinado, o combustível é ressarcido como despesa, estimado pela rota planejada e pelo consumo do seu veículo.',
    ],
  },
  {
    title: '8. Segurança',
    paragraphs: [
      'Respeite as leis de trânsito e use os equipamentos de segurança. Recomendamos ter seguro pessoal e do veículo.',
      'Em caso de acidente ou qualquer ocorrência, avise a operação pelo app ("Falar com a operação").',
    ],
  },
  {
    title: '9. Nos condomínios',
    paragraphs: [
      'Identifique-se com o crachá digital do app. Ele é pessoal: não dá para mandar outra pessoa no seu lugar, porque a portaria confere quem entra.',
      'Siga as regras de cada portaria e circule só pelas áreas necessárias para a entrega.',
    ],
  },
  {
    title: '10. Dados dos clientes',
    paragraphs: [
      'Você vê o nome, o bloco e o apartamento de cada cliente só para fazer a entrega. Esses dados são sigilosos, conforme a Lei Geral de Proteção de Dados.',
      'É proibido copiar, guardar, divulgar ou usar esses dados para outra coisa, e contatar o cliente fora do app. Os recados são só os modelos prontos do app.',
      'Se perceber qualquer uso indevido de dados, avise a operação na hora.',
    ],
  },
  {
    title: '11. Seus dados',
    paragraphs: [
      'Como tratamos os seus dados está na Política de Privacidade, na seção "Se você é entregador": a localização é usada só durante a rota e apagada quando ela termina, e as fotos das entregas são apagadas em 90 dias.',
    ],
  },
  {
    title: '12. Sua imagem',
    paragraphs: [
      'Você autoriza o uso da sua foto e do seu primeiro nome no app, no crachá digital e para o cliente saber quem está a caminho, enquanto durar a parceria. Quando ela termina, deixamos de usar.',
    ],
  },
  {
    title: '13. Fim da parceria',
    paragraphs: [
      'Você ou o Cheirin de Pão podem encerrar a parceria a qualquer momento, sem multa. As entregas já feitas são pagas normalmente.',
      'Ao encerrar, o acesso ao app e o crachá digital são desativados.',
    ],
  },
  {
    title: '14. Mudanças neste termo',
    paragraphs: ['Quando o termo mudar, avisamos no app. Para continuar entregando, você precisa ler e aceitar a versão nova.'],
  },
  {
    title: '15. Contato',
    paragraphs: [
      // TODO(jurídico): foro.
      `Dúvidas sobre este termo: fale com a operação pelo app ou escreva para ${LEGAL_CONTACT_EMAIL}. Pedidos sobre os seus dados seguem a página "Exclusão de dados" (prazo de até ${DELETION_DAYS} dias).`,
    ],
  },
]
