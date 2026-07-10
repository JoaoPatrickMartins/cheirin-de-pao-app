# Summary: 07-11 — AdminGestao hub + CRUD de entidades

## O que foi construído

**10 arquivos criados/modificados:**

- `apps/web/src/pages/admin/tabs/AdminGestao.tsx` — Hub com 7 cards (combos, avulso, fornecedores, entregadores, condos, pagamentos, financeiro); sub-estado interno substitui hub por sub-tela
- `apps/web/src/pages/admin/gestao/AdminCombos.tsx` — Lista CRUD de combos com Switch de promoção otimista (ADMG-02, ADMG-03)
- `apps/web/src/pages/admin/gestao/AdminAvulso.tsx` — Steppers de limite e preço por pão com prévia do incentivo em card espresso (ADMG-04)
- `apps/web/src/pages/admin/gestao/ComboForm.tsx` — Formulário nome/qtd/preço/tag; POST ou PATCH conforme id
- `apps/web/src/pages/admin/gestao/AdminFornecedores.tsx` — Lista CRUD com badge "Principal" dourado; footer preco/pão + tel + e-mail (ADMG-05)
- `apps/web/src/pages/admin/gestao/FornecedorForm.tsx` — Campos nome, CNPJ, tel, e-mail, preço/pão, Switch isPrincipal
- `apps/web/src/pages/admin/gestao/AdminEntregadores.tsx` — Lista com Switch ativo/inativo; toggle otimista com reverter em erro (ADMG-06, ADMG-07)
- `apps/web/src/pages/admin/gestao/EntregadorForm.tsx` — Campos nome, CPF, tel, e-mail; apenas criação no MVP
- `apps/web/src/pages/admin/gestao/AdminCondos.tsx` — Lista CRUD com card clicável para editar; tipo + nº clientes (ADMG-01)
- `apps/web/src/pages/admin/gestao/CondoForm.tsx` — Campos nome, endereço, SegmentedControl tipo, numBlocos condicional
- `apps/web/src/pages/admin/AdminLayout.tsx` — Wire-up `{tab === 'gestao' && <AdminGestao />}`

## Padrões aplicados

- Sub-estado D-02: `sub: AdminGestaoSub` no hub, `sub: null|'criar'|'editar'` nas sub-telas
- Formulário D-03: ocupa tela toda (AppBar + campos + botão salvar)
- Toggle otimista: estado local + PATCH em background + revert em catch
- Switch de promoção: `setCombos(prev => prev.map(...))` otimista + PATCH + revert em erro

## Requisitos cobertos

ADMG-01 (condos CRUD), ADMG-02 (combos lista), ADMG-03 (toggle promoção), ADMG-04 (avulso steppers + prévia), ADMG-05 (fornecedores badge principal), ADMG-06 (entregadores lista), ADMG-07 (entregadores toggle ativo/inativo)
