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
  { id: 'c1', nome: 'Café da Manhã', qtd: 10, preco: 8.9, antes: null, tag: null, desc: 'O essencial do dia' },
  { id: 'c2', nome: 'Família', qtd: 30, preco: 24.9, antes: null, tag: 'Mais popular', desc: 'O equilíbrio da casa' },
  { id: 'c3', nome: 'Festa', qtd: 50, preco: 37.9, antes: null, tag: 'Melhor valor', desc: 'Pra mesa cheia' },
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
      { ap: 'Bloco A · 102', cliente: 'Marina R.', qtd: 4, feito: false },
      { ap: 'Bloco A · 308', cliente: 'Júlio M.', qtd: 2, feito: false },
      { ap: 'Bloco B · 51', cliente: 'Dona Cida', qtd: 6, feito: false },
      { ap: 'Bloco C · 204', cliente: 'Rafael T.', qtd: 2, feito: false },
    ],
  },
  {
    condo: 'Edifício Ipê Amarelo', bairro: 'Centro', total: 8,
    paradas: [
      { ap: 'Ap 71', cliente: 'Helena B.', qtd: 4, feito: false },
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

Object.assign(window, { BRL, DIAS, COMBOS, PRICING_DEFAULT, CONDOS, ORDERS, ENTREGAS, ADMIN_CONDOS, FORNECEDORES, ADMIN_CLIENTES, ENTREGADORES, PAGAMENTOS, PEDIDO_DIA, TRACK_STEPS });
