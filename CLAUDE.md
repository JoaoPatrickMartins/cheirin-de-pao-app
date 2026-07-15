<!-- GSD:project-start source:PROJECT.md -->
## Project

**Cheirin de Pão**

PWA (Progressive Web App) de entrega recorrente de pãezinhos em condomínios, baseado em sistema de créditos. O cliente compra combos de pãezinhos que viram créditos, monta uma agenda semanal personalizada e os pãezinhos chegam na porta toda manhã. Três perfis: Cliente (compra, agenda, acompanha), Entregador (rota e confirmação de entrega) e Admin (operação completa — pedido ao fornecedor, financeiro, gestão).

**Core Value:** O cliente configura a agenda uma vez e os pãezinhos chegam todo dia sem que ele precise fazer nada — o sistema cuida dos créditos, dos agendamentos e das notificações automaticamente.

### Constraints

- **Stack Frontend**: React + Vite + Tailwind CSS + Zod — definido e não revisitável
- **Stack Backend**: Node.js + Fastify + Prisma + MongoDB Atlas — definido e não revisitável
- **Monorepo**: Turborepo com npm workspaces — estrutura de pasta já especificada
- **Banco**: MongoDB Atlas remoto (não local) — tanto em dev quanto em produção
- **Pagamentos**: Mercado Pago exclusivamente (Pix + cartão)
- **Push**: OneSignal (gratuito, suporte nativo a PWA)
- **Mapas**: OpenStreetMap + Leaflet + OSRM (gratuito, open source)
- **Autenticação**: Sem senha — apenas OTP via SMS/e-mail
- **Hospedagem**: VPS (DigitalOcean ou Hostinger) com Docker + Nginx + Let's Encrypt
- **Fidelidade de Design**: Alta fidelidade — cores, tipografia e espaçamentos definidos no handoff são mandatórios
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- USER RULE — fora dos blocos GSD de propósito (não sobrescrever) -->
## Git — Commits e Push (regra mandatória)

NUNCA execute `git commit` nem `git push` — nem estague/prepare com essa intenção — sem que o usuário autorize **explicitamente** naquele momento.

"Funcionou", "perfeito", aprovação de um plano ou um "pode seguir" genérico **NÃO** contam como permissão para commitar/pushar. O aval precisa ser explícito e pedido a cada vez (ex.: "faça o commit", "pode commitar e dar push").
