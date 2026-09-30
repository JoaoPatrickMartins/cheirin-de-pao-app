/* ============================================================
   Cheirin de Pão — Dados mock + helpers
   ============================================================ */
const BRL = n => 'R$ ' + n.toFixed(2).replace('.', ',');

const DIAS = [
  { k: 'seg', label: 'Segunda', curt: 'Seg' },
  { k: 'ter', label: 'Terça', curt: 'Ter' },
  { k: 'qua', label: 'Quarta', curt: 'Qua' },
  { k: 'qui', label: 'Quinta', curt: 'Qui' },
  { k: 'sex', label: 'Sexta', curt: 'Sex' },
  { k: 'sab', label: 'Sábado', curt: 'Sáb' },
  { k: 'dom', label: 'Domingo', curt: 'Dom' },
];

const COMBOS = [
  { id: 'c1', nome: 'Café da Manhã', qtd: 10, preco: 8.9, antes: null, economia: 26, tag: null, desc: 'O essencial do dia' },
  { id: 'c2', nome: 'Família', qtd: 30, preco: 24.9, antes: null, economia: 31, tag: 'Mais popular', desc: 'O equilíbrio da casa' },
  { id: 'c3', nome: 'Festa', qtd: 50, preco: 37.9, antes: null, economia: 37, tag: 'Melhor valor', desc: 'Pra mesa cheia' },
];

/* Configuração de preço controlada pelo admin (sec. 2.2):
   - avulsoLimite: primeira quantidade que passa a ser só via combo
   - avulsoUnit: preço por pão na compra personalizada (mais caro que o combo) */
const PRICING_DEFAULT = { avulsoLimite: 20, avulsoUnit: 1.2 };

const CONDOS = [
  { id: 'k1', nome: 'Residencial Aurora', bairro: 'Jardim Botânico', tipo: 'blocos', blocos: ['A', 'B', 'C'] },
  { id: 'k2', nome: 'Edifício Ipê Amarelo', bairro: 'Centro', tipo: 'unica' },
  { id: 'k3', nome: 'Condomínio Vista Verde', bairro: 'Alphaville', tipo: 'blocos', blocos: ['Torre 1', 'Torre 2'] },
  { id: 'k4', nome: 'Village das Acácias', bairro: 'Granja Viana', tipo: 'unica' },
];

const ORDERS = [
  { id: 'o1', data: 'Hoje, 11 jun', qtd: 4, status: 'a_caminho', tipo: 'Agendamento', hora: '07:10' },
  { id: 'o2', data: 'Ontem, 10 jun', qtd: 4, status: 'entregue', tipo: 'Agendamento', hora: '06:58' },
  { id: 'o3', data: 'Seg, 9 jun', qtd: 6, status: 'entregue', tipo: 'Pedido único', hora: '07:04' },
  { id: 'o4', data: 'Sáb, 7 jun', qtd: 8, status: 'entregue', tipo: 'Pedido único', hora: '08:22' },
  { id: 'o5', data: 'Sex, 6 jun', qtd: 4, status: 'entregue', tipo: 'Agendamento', hora: '07:01' },
];

const ENTREGAS = [
  {
    condo: 'Residencial Aurora', bairro: 'Jardim Botânico', total: 14,
    paradas: [
      { ap: 'Bloco A · 102', cliente: 'Marina R.', qtd: 4, feito: false, mkt: [{ nome: 'geleia', qtd: 1 }, { nome: 'pão de queijo', qtd: 1 }] },
      { ap: 'Bloco A · 308', cliente: 'Júlio M.', qtd: 2, feito: false },
      { ap: 'Bloco B · 51', cliente: 'Dona Cida', qtd: 6, feito: false, mkt: [{ nome: 'bolo de fubá', qtd: 1 }] },
      { ap: 'Bloco C · 204', cliente: 'Rafael T.', qtd: 2, feito: false },
    ],
  },
  {
    condo: 'Edifício Ipê Amarelo', bairro: 'Centro', total: 8,
    paradas: [
      { ap: 'Ap 71', cliente: 'Helena B.', qtd: 4, feito: false, mkt: [{ nome: 'requeijão', qtd: 1 }, { nome: 'suco', qtd: 2 }] },
      { ap: 'Ap 142', cliente: 'Pedro A.', qtd: 4, feito: false },
    ],
  },
];

const ADMIN_CONDOS = [
  { nome: 'Residencial Aurora', clientes: 23, tipo: 'Blocos A/B/C' },
  { nome: 'Edifício Ipê Amarelo', clientes: 11, tipo: 'Entrada única' },
  { nome: 'Condomínio Vista Verde', clientes: 18, tipo: 'Torres 1/2' },
  { nome: 'Village das Acácias', clientes: 7, tipo: 'Entrada única' },
];

/* ---------- Fornecedores (sec. 3.2 / 6) ---------- */
const FORNECEDORES = [
  { id: 'f1', nome: 'Padaria Pão Quente', cnpj: '12.345.678/0001-90', tel: '(11) 3322-1100', email: 'pedidos@paoquente.com.br', endereco: 'R. das Flores, 240 · Centro', preco: 0.90, principal: true },
  { id: 'f2', nome: 'Forno do Bairro', cnpj: '98.765.432/0001-21', tel: '(11) 3344-5500', email: 'contato@fornodobairro.com', endereco: 'Av. Brasil, 1820 · Vila Nova', preco: 0.95, principal: false },
  { id: 'f3', nome: 'Massa Fina Distribuidora', cnpj: '45.111.222/0001-33', tel: '(11) 3090-7788', email: 'comercial@massafina.com.br', endereco: 'Rod. Anhanguera km 22', preco: 0.88, principal: false },
];

/* ---------- Clientes (painel admin, sec. 4.3) ---------- */
const ADMIN_CLIENTES = [
  { nome: 'Marina Ribeiro', condo: 'Residencial Aurora', apto: 'A · 102', saldo: 38, ultima: '11 jun', bloqueado: false },
  { nome: 'Júlio Mendes', condo: 'Residencial Aurora', apto: 'A · 308', saldo: 6, ultima: '10 jun', bloqueado: false },
  { nome: 'Cida Almeida', condo: 'Residencial Aurora', apto: 'B · 51', saldo: 52, ultima: '11 jun', bloqueado: false },
  { nome: 'Helena Borges', condo: 'Edifício Ipê Amarelo', apto: 'Ap 71', saldo: 0, ultima: '02 jun', bloqueado: false },
  { nome: 'Pedro Antunes', condo: 'Edifício Ipê Amarelo', apto: 'Ap 142', saldo: 14, ultima: '09 jun', bloqueado: true },
  { nome: 'Rafael Tavares', condo: 'Condomínio Vista Verde', apto: 'T1 · 204', saldo: 21, ultima: '08 jun', bloqueado: false },
];

/* ---------- Entregadores (sec. 4.2 / 4.3) ---------- */
const ENTREGADORES = [
  { id: 'e1', nome: 'Antônio Souza', cpf: '123.456.789-00', tel: '(11) 99888-7766', email: 'antonio@cheirin.com', ativo: true, condos: ['Residencial Aurora', 'Edifício Ipê Amarelo'] },
  { id: 'e2', nome: 'Dona Tereza', cpf: '987.654.321-00', tel: '(11) 99777-6655', email: 'tereza@cheirin.com', ativo: true, condos: ['Condomínio Vista Verde'] },
  { id: 'e3', nome: 'Marcos Lima', cpf: '456.789.123-00', tel: '(11) 99666-5544', email: 'marcos@cheirin.com', ativo: false, condos: [] },
];

/* ---------- Pagamentos (sec. 4.3) ---------- */
const PAGAMENTOS = [
  { id: 'p1', cliente: 'Marina Ribeiro', valor: 24.90, tipo: 'Combo Família', metodo: 'Pix', status: 'pago', data: '11 jun · 06:32' },
  { id: 'p2', cliente: 'Cida Almeida', valor: 37.90, tipo: 'Combo Festa', metodo: 'Cartão', status: 'pago', data: '11 jun · 05:58' },
  { id: 'p3', cliente: 'Rafael Tavares', valor: 7.20, tipo: 'Compra personalizada', metodo: 'Pix', status: 'pendente', data: '10 jun · 21:40' },
  { id: 'p4', cliente: 'Pedro Antunes', valor: 8.90, tipo: 'Combo Café da Manhã', metodo: 'Cartão', status: 'falhou', data: '10 jun · 19:12' },
  { id: 'p5', cliente: 'Júlio Mendes', valor: 24.90, tipo: 'Combo Família', metodo: 'Pix', status: 'pago', data: '09 jun · 08:05' },
];

/* ---------- Pedido do dia ao fornecedor (sec. 6) ---------- */
const PEDIDO_DIA = {
  horaCorte: '20:00',
  totalPaes: 340,
  porCondo: [
    { condo: 'Residencial Aurora', paes: 142, paradas: 23 },
    { condo: 'Edifício Ipê Amarelo', paes: 68, paradas: 11 },
    { condo: 'Condomínio Vista Verde', paes: 96, paradas: 18 },
    { condo: 'Village das Acácias', paes: 34, paradas: 7 },
  ],
};

/* ---------- Linha do tempo de uma entrega (3 estados, sec. 4.1) ---------- */
const TRACK_STEPS = [
  { k: 'agendado', label: 'Agendado', desc: 'Pedido confirmado e créditos reservados', hora: 'Ontem, 20:14' },
  { k: 'saiu', label: 'Saiu para entrega', desc: 'Antônio está a caminho do seu condomínio', hora: 'Hoje, 06:48' },
  { k: 'entregue', label: 'Entregue', desc: 'Pãezinhos na sua porta. Bom dia!', hora: '—' },
];

/* ============================================================
   Além do Pãozin — mini market (dados)
   ============================================================ */
const MARKET_CFG = { minimo: 15.00 }; // marketMinimoCestinha (R$)

const MARKET_CATS = [
  { k: 'g', nome: 'Geleias & Mel', emoji: '🍯' },
  { k: 'b', nome: 'Bolos & Doces', emoji: '🍰' },
  { k: 's', nome: 'Pão de Queijo & Salgados', emoji: '🧀' },
  { k: 'd', nome: 'Bebidas', emoji: '🥤' },
  { k: 'f', nome: 'Frios & Frescos', emoji: '🧈' },
  { k: 'e', nome: 'Especiais', emoji: '🎁' },
];

/* estoqueTipo: 'diario' (reseta) | 'fixo' (inventário)
   dispo: 'sempre' | array de dias · limitado: pill "Últimas unidades" */
const MARKET_PRODS = [
  { id: 'm1', nome: 'Geleia de Morango Artesanal', cat: 'g', preco: 12.00, desc: 'Feita com morangos da estação e pouco açúcar. Pote de 240g.', estoqueTipo: 'fixo', estoque: 18, dispo: 'sempre' },
  { id: 'm2', nome: 'Mel Silvestre 300g', cat: 'g', preco: 18.00, desc: 'Mel puro de floradas silvestres, sem adição de açúcar.', estoqueTipo: 'fixo', estoque: 9, dispo: 'sempre' },
  { id: 'm3', nome: 'Geleia de Damasco', cat: 'g', preco: 13.50, desc: 'Damascos turcos cozidos lentamente. Pote de 240g.', estoqueTipo: 'fixo', estoque: 3, dispo: 'sempre', limitado: true },
  { id: 'm4', nome: 'Bolo de Fubá Cremoso', cat: 'b', preco: 15.00, desc: 'Assado toda manhã, cremoso por dentro. Fatia generosa.', estoqueTipo: 'diario', estoque: 12, dispo: 'sempre' },
  { id: 'm5', nome: 'Broa de Milho', cat: 'b', preco: 9.00, desc: 'Receita da vó, crocante por fora. Unidade.', estoqueTipo: 'diario', estoque: 20, dispo: 'sempre' },
  { id: 'm6', nome: 'Cookie de Castanhas', cat: 'b', preco: 6.00, desc: 'Amanteigado com castanha-do-pará. Unidade.', estoqueTipo: 'diario', estoque: 2, dispo: 'sempre', limitado: true },
  { id: 'm7', nome: 'Pão de Queijo (6 un)', cat: 's', preco: 10.00, desc: 'Mineiro de verdade, com queijo canastra. Saco com 6.', estoqueTipo: 'diario', estoque: 15, dispo: 'sempre' },
  { id: 'm8', nome: 'Empada de Frango', cat: 's', preco: 8.50, desc: 'Massa que desmancha, recheio caseiro. Unidade.', estoqueTipo: 'diario', estoque: 10, dispo: 'sempre' },
  { id: 'm9', nome: 'Chipa Paraguaia', cat: 's', preco: 11.00, desc: 'Só nos dias de fornada especial. Saco com 5.', estoqueTipo: 'diario', estoque: 8, dispo: ['seg', 'qua', 'sex'] },
  { id: 'm10', nome: 'Café Coado 300ml', cat: 'd', preco: 7.00, desc: 'Coado na hora com grãos torrados na semana.', estoqueTipo: 'diario', estoque: 25, dispo: 'sempre' },
  { id: 'm11', nome: 'Suco de Laranja 500ml', cat: 'd', preco: 9.50, desc: 'Espremido na hora, sem açúcar nem água.', estoqueTipo: 'diario', estoque: 14, dispo: 'sempre' },
  { id: 'm12', nome: 'Requeijão Artesanal', cat: 'f', preco: 14.00, desc: 'Cremoso e sem amido. Pote de 200g.', estoqueTipo: 'fixo', estoque: 7, dispo: 'sempre' },
  { id: 'm13', nome: 'Manteiga de Garrafa', cat: 'f', preco: 16.00, desc: 'Do sertão, para o pão quentinho. Garrafa 300ml.', estoqueTipo: 'fixo', estoque: 5, dispo: 'sempre' },
  { id: 'm14', nome: 'Queijo Minas Frescal', cat: 'f', preco: 22.00, desc: 'Fresquinho, do produtor local. Peça de 500g.', estoqueTipo: 'fixo', estoque: 0, dispo: 'sempre', esgotado: true },
  { id: 'm15', nome: 'Ovos Caipira (dúzia)', cat: 'e', preco: 15.00, desc: 'De galinhas criadas soltas. Dúzia.', estoqueTipo: 'fixo', estoque: 11, dispo: 'sempre' },
  { id: 'm16', nome: 'Cesta Café Completo', cat: 'e', preco: 45.00, desc: 'Pão de queijo, geleia, café, bolo e manteiga. Pra fim de semana.', estoqueTipo: 'fixo', estoque: 3, dispo: 'sempre', limitado: true },
];

/* pãezinhos equivalentes (resgate segue avulsoUnit) */
const paezinhosDe = (preco, unit) => Math.round(preco / unit);
/* economia ao pagar com pãezinhos: crédito custa ~comboUnit mas resgata a avulsoUnit */
function economiaCredito(pricing, combos) {
  const best = combos.reduce((m, c) => (c.preco / c.qtd) < (m.preco / m.qtd) ? c : m, combos[0]);
  const comboUnit = best.preco / best.qtd;
  return Math.max(0, Math.round((1 - comboUnit / pricing.avulsoUnit) * 100));
}

/* Pedido do market no acompanhamento / histórico (C7) */
const MARKET_ORDER = {
  id: 'mk1', data: 'Hoje, 11 jun', status: 'agendado', hora: '06:30', cancelavel: true,
  itens: [
    { nome: 'Geleia de Morango', qtd: 1 },
    { nome: 'Pão de Queijo (6 un)', qtd: 1 },
    { nome: 'Café Coado', qtd: 2 },
  ],
};

/* Separação do dia — mercadinho por condomínio/slot (A6) */
const MKT_SEPARACAO = [
  { condo: 'Residencial Aurora', slot: 'Manhã · 06:30', paes: 142, paradas: 23, itens: [{ nome: 'geleia', qtd: 3 }, { nome: 'pão de queijo', qtd: 4 }, { nome: 'café', qtd: 2 }, { nome: 'bolo de fubá', qtd: 1 }] },
  { condo: 'Edifício Ipê Amarelo', slot: 'Manhã · 06:30', paes: 68, paradas: 11, itens: [{ nome: 'requeijão', qtd: 1 }, { nome: 'suco', qtd: 2 }] },
  { condo: 'Condomínio Vista Verde', slot: 'Tarde · 15:30', paes: 96, paradas: 18, itens: [{ nome: 'cesta café', qtd: 1 }, { nome: 'empada', qtd: 3 }, { nome: 'mel', qtd: 1 }] },
];

Object.assign(window, { MARKET_CFG, MARKET_CATS, MARKET_PRODS, paezinhosDe, economiaCredito, MARKET_ORDER, MKT_SEPARACAO });

/* ============================================================
   Indique e Ganhe — mocks (ver handoff-indique-e-ganhe.md §2)
   ============================================================ */
const REFERRAL_CFG = {
  ativo: true, recompensa: 5, bonusAmigo: 3, compraMinima: 0,
  limiteMensal: 10, prazoDias: 60,
  campanha: { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '05/10', fim: '11/10' }, // ou null
  metas: [{ quantidade: 5, bonus: 10 }, { quantidade: 10, bonus: 25 }],
  mensagem: 'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o meu código {codigo} e ganha {bonus} pãezins no primeiro pedido: {link}',
};
const REF_UNIT = 1.0; // custo estimado de 1 pãozin em R$ (mock — no app, vem do pricing)
const MY_CODE = 'JOAO7K2F';
const MY_NAME = 'João';
const REF_LINK = code => 'app.cheirindepao.com.br/?ref=' + code;
const MY_REFERRALS = [
  { nome: 'Maria S.', estado: 'ganhou', data: '12/09', ganho: 5 },
  { nome: 'Pedro A.', estado: 'ganhou', data: '03/09', ganho: 10, campanha: true },
  { nome: 'Ana L.', estado: 'aguardando', data: '20/09' },
  { nome: 'Carlos M.', estado: 'cadastro', data: '26/09' },
  { nome: 'Júlia R.', estado: 'analise', data: '18/09' },
  { nome: 'Bruno F.', estado: 'recusada', data: '28/08' },
  { nome: 'Rafael T.', estado: 'expirou', data: '10/07' },
];
const REFERRAL_REPORT = {
  visitas: 240, cadastros: 38, confirmados: 31, recompensados: 17,
  paesIndicador: 85, paesAmigo: 51, custo: 136.0, receitaIndicados: 1920.0,
  porEstado: { cadastro: 4, aguardando: 9, analise: 3, ganhou: 17, recusada: 2, expirou: 3 },
  top: [
    { nome: 'João Silva', ind: 7, ganhos: 45 }, { nome: 'Fernanda Lima', ind: 5, ganhos: 35 },
    { nome: 'Ricardo Alves', ind: 4, ganhos: 20 }, { nome: 'Beatriz Rocha', ind: 3, ganhos: 15 },
    { nome: 'Luiz Andrade', ind: 2, ganhos: 10 },
  ],
};
/* estado admin: analise · aguardando · cadastro · ganhou · recusada · expirou */
const ADMIN_REFERRALS = [
  { id: 'r1', de: 'João Silva', para: 'Júlia Ramos', data: '18/09', estado: 'analise', sinais: ['Mesmo apartamento'], x: 5, y: 3, campanha: null, cond: 'Parque das Flores', tl: { cadastro: '18/09 09:12', login: '18/09 09:20', pagamento: '19/09 21:40', entrega: '20/09 06:31' } },
  { id: 'r2', de: 'Fernanda Lima', para: 'Otávio Nunes', data: '22/09', estado: 'analise', sinais: ['Mesmo aparelho', 'Limite do mês'], x: 5, y: 3, campanha: null, cond: 'Vila Jardim', tl: { cadastro: '22/09 18:03', login: '22/09 18:05', pagamento: '23/09 20:11', entrega: '24/09 06:40' } },
  { id: 'r3', de: 'Marcos Dias', para: 'Sônia Prado', data: '25/09', estado: 'analise', sinais: ['Indicador bloqueado'], x: 10, y: 3, campanha: 'Semana em dobro', cond: 'Residencial Aurora', tl: { cadastro: '25/09 07:50', login: '25/09 07:52', pagamento: '25/09 21:00', entrega: '26/09 06:28' } },
  { id: 'r4', de: 'João Silva', para: 'Ana Lopes', data: '20/09', estado: 'aguardando', sinais: [], x: 5, y: 3, campanha: null, cond: 'Parque das Flores', tl: { cadastro: '20/09 12:30', login: '20/09 12:34' } },
  { id: 'r5', de: 'Ricardo Alves', para: 'Paula Mendes', data: '26/09', estado: 'cadastro', sinais: [], x: 5, y: 3, campanha: null, cond: 'Vila Jardim', tl: { cadastro: '26/09 16:02' } },
  { id: 'r6', de: 'João Silva', para: 'Maria Souza', data: '12/09', estado: 'ganhou', sinais: [], x: 5, y: 3, campanha: null, cond: 'Parque das Flores', tl: { cadastro: '12/09 08:10', login: '12/09 08:12', pagamento: '13/09 19:30', entrega: '14/09 06:35', recompensa: '14/09 06:35' } },
  { id: 'r7', de: 'Beatriz Rocha', para: 'Hugo Castro', data: '28/08', estado: 'recusada', sinais: ['Mesmo apartamento', 'Mesmo aparelho'], x: 5, y: 3, campanha: null, cond: 'Residencial Aurora', motivo: 'Mesma residência do indicador', tl: { cadastro: '28/08 10:00', login: '28/08 10:01', pagamento: '29/08 20:00', entrega: '30/08 06:30' } },
  { id: 'r8', de: 'João Silva', para: 'Rafael Teixeira', data: '10/07', estado: 'expirou', sinais: [], x: 5, y: 3, campanha: null, cond: 'Parque das Flores', tl: { cadastro: '10/07 14:22', login: '10/07 14:25' } },
];
const CONDO_INTERESTS = [
  { nome: 'Condomínio Solar das Palmeiras', cidade: 'Campinas', pedidos: 7, indicacao: 4, contatos: [
    { nome: 'Luciana P.', contato: 'luciana@email.com', data: '24/09', ind: true }, { nome: 'Roberto K.', contato: '(19) 9 8123-4400', data: '22/09', ind: true }, { nome: 'Camila V.', contato: 'camila.v@email.com', data: '19/09', ind: false } ] },
  { nome: 'Residencial Bosque Azul', cidade: 'Valinhos', pedidos: 4, indicacao: 1, contatos: [
    { nome: 'Diego M.', contato: '(19) 9 9912-3030', data: '25/09', ind: true }, { nome: 'Patrícia S.', contato: 'pat.s@email.com', data: '20/09', ind: false } ] },
  { nome: 'Edifício Monte Verde', cidade: 'Campinas', pedidos: 2, indicacao: 2, contatos: [
    { nome: 'Tiago R.', contato: 'tiago@email.com', data: '26/09', ind: true } ] },
  { nome: 'Vila das Acácias', cidade: 'Sumaré', pedidos: 1, indicacao: 0, tratado: true, contatos: [
    { nome: 'Helena F.', contato: '(19) 9 8800-1122', data: '02/09', ind: false } ] },
];
const refMsg = (cfg, code = MY_CODE, nome = MY_NAME) => {
  let m = cfg.mensagem;
  if (!cfg.bonusAmigo) m = m.replace(/ e ganha \{bonus\} pãezins no primeiro pedido/, '');
  return m.replace(/\{codigo\}/g, code).replace(/\{link\}/g, REF_LINK(code)).replace(/\{nome\}/g, nome).replace(/\{bonus\}/g, cfg.bonusAmigo);
};
const paez = n => { const s = String(n).replace('.', ','); return s + (n === 1 ? ' pãozin' : ' pãezins'); };

Object.assign(window, { REFERRAL_CFG, REF_UNIT, MY_CODE, MY_NAME, REF_LINK, MY_REFERRALS, REFERRAL_REPORT, ADMIN_REFERRALS, CONDO_INTERESTS, refMsg, paez });

/* ============================================================
   Login social — mocks (ver handoff-login-social.md §2)
   ============================================================ */
const SOCIAL_PROVIDERS = { google: true, facebook: true };
const SOCIAL_PREFILL = { provider: 'google', name: 'Marina Ribeiro', email: 'marina.ribeiro@gmail.com' };
const SOCIAL_PREFILL_FB = { provider: 'facebook', name: 'Ana Costa', email: 'ana@exemplo.com' };
const SOCIAL_LINK = { maskedEmail: 'ma•••@gmail.com', canUsePassword: true };
const CONNECTED_ACCOUNTS = [
  { provider: 'google', email: 'marina.ribeiro@gmail.com', linkedAt: '30/09' },
];
const SOCIAL_NAMES = { google: 'Google', facebook: 'Facebook' };

Object.assign(window, { SOCIAL_PROVIDERS, SOCIAL_PREFILL, SOCIAL_PREFILL_FB, SOCIAL_LINK, CONNECTED_ACCOUNTS, SOCIAL_NAMES });
