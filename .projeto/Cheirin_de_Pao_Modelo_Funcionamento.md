# Cheirin de Pão

## Modelo de Funcionamento — Sistema de Créditos e Agendamentos

**Versão 0.1 • Junho 2026**

---

## 1. Visão Geral do Modelo

O Cheirin de Pão funciona com um modelo baseado em créditos e agendamentos. O cliente não precisa ser um assinante recorrente para utilizar o serviço — ele pode fazer pedidos únicos ou configurar agendamentos semanais personalizados. O sistema é flexível e se adapta ao estilo de consumo de cada cliente.

O fluxo principal se resume em três pilares:

- Comprar créditos (pãezinhos) por meio de combos
- Usar os créditos para agendar entregas (única ou recorrente)
- Receber os pãezinhos na porta de casa conforme o agendamento

---

## 2. Sistema de Créditos (Combos)

### 2.1 Como funciona

O cliente adquire créditos de pãezinhos através da compra de combos pré-configurados pelo admin. Cada combo equivale a uma quantidade específica de pãezinhos.

> **Exemplo prático**
>
> O cliente compra o Combo 30 (30 pãezinhos) → paga o valor definido pelo admin.
> Imediatamente recebe 30 créditos de pãezinhos na sua conta.
> Esses créditos podem ser consumidos de uma só vez ou distribuídos ao longo dos agendamentos.

### 2.2 Compra personalizada (avulsa)

Para quantidades menores, o cliente pode fazer uma compra personalizada, escolhendo a quantidade exata de pãezinhos que deseja. Essa modalidade é limitada a uma quantidade máxima definida pelo admin.

> **Estratégia de preço**
>
> O preço unitário da compra personalizada é propositalmente mais alto que o dos combos.
> Isso incentiva o cliente a optar pelos combos em quantidade, gerando recorrência de compra.
>
> **Exemplo:**
> Compra personalizada: 5 pãezinhos × R$ 1,20 = R$ 6,00 (R$ 1,20/un)
> Combo Família (30 pães): R$ 24,90 (R$ 0,83/un) — 31% mais barato por unidade
>
> O admin define: limite máximo da compra personalizada (ex: até 19 pães) e o preço unitário.
> A partir de 20 pães (exemplo), o cliente só pode comprar via combos.

### 2.3 Uso dos créditos

Os créditos podem ser utilizados de duas formas:

- **Pedido único** — o cliente usa os créditos para um agendamento avulso, escolhendo a data e a quantidade de pãezinhos
- **Agendamento semanal** — os créditos são distribuídos automaticamente conforme a configuração semanal do cliente (ver seção 3)

**Importante:** Os créditos nunca expiram. Permanecem no saldo do cliente até serem consumidos em entregas realizadas.

### 2.4 Compra recorrente automática

O cliente pode ativar a compra recorrente de combos, com duas modalidades:

- **Compra semanal automática** — toda semana, na data/dia configurado, o combo é comprado automaticamente e os créditos são adicionados à conta
- **Compra quando estiver para acabar** — quando os créditos ficam abaixo do necessário para cumprir o próximo agendamento, o combo é comprado automaticamente

**Se o cliente não ativar compra automática:** o sistema envia uma notificação informando que não há créditos suficientes para o agendamento configurado, perguntando se deseja comprar para manter o agendamento.

---

## 3. Agendamentos

### 3.1 Pedido único (avulso)

O cliente pode, a qualquer momento, agendar uma entrega para uma data específica. Basta informar a data desejada e a quantidade de pãezinhos. Os créditos são reservados imediatamente.

### 3.2 Agendamento semanal recorrente personalizado

O cliente pode configurar um agendamento personalizado para cada dia da semana, definindo individualmente quantos pãezinhos deseja receber em cada dia.

> **Exemplo de configuração semanal**
>
> Segunda-feira: 4 pãezinhos
> Terça-feira: — (sem entrega)
> Quarta-feira: — (sem entrega)
> Quinta-feira: 10 pãezinhos
> Sexta-feira: 6 pãezinhos
> Sábado: 10 pãezinhos
> Domingo: 10 pãezinhos
>
> **Total semanal: 40 pãezinhos consumidos por semana**

O agendamento semanal se repete automaticamente toda semana até que o cliente altere ou desative.

### 3.3 Notificação de reconfiguração semanal

O cliente pode optar por receber uma notificação semanal para lembrar de reconfigurar a quantidade de pãezinhos para a semana seguinte. Isso é útil para quem tem variações de consumo semana a semana.

- Se ativada, a notificação é enviada em um dia/horário a definir (ex: domingo à noite)
- Se o cliente não alterar, o agendamento anterior se mantém automaticamente

---

## 4. Alertas e Notificações de Crédito

O sistema mantém o cliente sempre informado sobre o saldo de créditos em relação aos agendamentos:

#### Cenário 1 — Agendamento feito, crédito insuficiente

Se o cliente possui um agendamento configurado mas não tem créditos suficientes para cobrir, o sistema envia um alerta imediato com duas opções:

- Comprar um combo para cobrir o agendamento
- Ajustar o agendamento para caber nos créditos disponíveis

#### Cenário 2 — Créditos acabando com compra automática

Se o cliente ativou compra automática, o combo é adquirido sem intervenção e os créditos são repostos. O cliente recebe apenas uma notificação de confirmação.

#### Cenário 3 — Créditos acabando sem compra automática

Notificação enviada informando o saldo atual e perguntando se deseja comprar um combo. Se não comprar a tempo, o agendamento do dia é suspenso e o cliente é notificado.

---

## 5. Gestão de Combos (Admin)

O admin tem controle total sobre os combos de pãezinhos disponíveis na plataforma:

- **Criar novos combos** — definir nome, quantidade de pãezinhos e preço
- **Editar combos existentes** — alterar quantidade, preço ou nome
- **Remover combos** — desativar combos que não serão mais oferecidos
- **Promoções e descontos** — aplicar preços promocionais temporários ou descontos percentuais/fixos a combos específicos

> **Exemplos de combos**
>
> Combo Café da Manhã: 10 pãezinhos — R$ 8,90
> Combo Família: 30 pãezinhos — R$ 24,90
> Combo Festa: 50 pãezinhos — R$ 37,90
> Promoção Semanal: Combo Família com 15% OFF → R$ 21,17

---

## 6. Fluxo do Pedido ao Fornecedor (Admin)

Todo dia, o admin precisa consolidar os agendamentos dos clientes e gerar um pedido de compra ao fornecedor para o dia seguinte. O fluxo funciona assim:

1. Admin define um horário de corte na plataforma (ex: 20h)
2. Até esse horário, clientes podem agendar ou alterar pedidos para o dia seguinte
3. Ao atingir o horário de corte, o sistema bloqueia novos pedidos e notifica clientes que não agendaram
4. O app exibe um aviso ao cliente de que o prazo para o dia seguinte encerrou
5. Após o corte, o admin acessa o painel e visualiza a lista completa de entregas por condomínio, bloco e apartamento
6. O admin clica para gerar o pedido de compra — o sistema calcula o total de pães necessários
7. O admin pode ajustar quantidades antes de finalizar (margem de segurança, arredondamento, etc.)
8. O admin escolhe o fornecedor principal e, se desejar, divide o pedido entre múltiplos fornecedores
9. O relatório com quantidade total e valor por fornecedor fica disponível para download em PDF ou Excel
10. O pedido é salvo no histórico para consulta futura

> **Exemplo prático**
>
> Horário de corte: 20h
> Total de agendamentos para amanhã: 340 pães
> Fornecedor A (padaria local): 250 pães × R$ 0,90 = R$ 225,00
> Fornecedor B (padaria reserva): 90 pães × R$ 0,95 = R$ 85,50
> Total do pedido: R$ 310,50
> Admin baixa o relatório e envia aos fornecedores.

---

## 7. Fluxo Resumido do Cliente

Desde o cadastro até o recebimento dos pãezinhos:

1. Cliente faz o cadastro no app e vincula ao condomínio
2. Acessa a loja de combos e compra créditos de pãezinhos
3. Configura um agendamento (único ou semanal personalizado)
4. Sistema reserva os créditos e confirma o agendamento
5. No dia da entrega, o entregador recebe a lista de entregas do condomínio
6. Cliente recebe notificação push quando a entrega é realizada
7. Créditos são consumidos após confirmação da entrega
8. Se créditos acabarem, sistema notifica e oferece opções de compra

---

*Documento de referência — modelo sujeito a refinamentos durante o levantamento de requisitos.*
