# Conflict Detection Report

Generated: 2026-06-19
Source: .projeto/add-feat-projeto-v11.md (PRD)

---

### BLOCKERS (0)

Nenhum.

---

### WARNINGS (0)

~~[WARNING] Variante concorrente para SLOT-01~~ — **RESOLVIDO** (2026-06-19)
- Decisão: modelo 2 slots fixos (manhã e tarde) mantido — admin edita horário individualmente
- SLOT-01 em REQUIREMENTS.md mantido como estava
- PRD menciona adição/remoção dinâmica, mas o produto prioriza simplicidade: 2 slots fixos por condomínio

---

### INFO (2)

**[INFO] PRD totalmente coberto — nenhum requisito net-new**
- Todas as 6 áreas de feature do add-feat-projeto-v11.md já estão capturadas na seção v1.1 de REQUIREMENTS.md (29 requirements mapeados para Fases 10–14).
- Ingest valida e confirma o planejamento existente.

**[INFO] Auto-resolvido: D-16 (decisão estabelecida) > CARD-04 (texto de requisito) sobre CVV**
- CARD-04 descreve CVV capturado uma vez no cadastro do cartão; compras subsequentes usam token direto.
- D-16 (STATE.md) estabelece CVV obrigatório via MP Brick em cada transação com cartão salvo.
- D-16 vence — CARD-04 deve ser lido como "CVV recapturado via Brick por transação; nenhum CVV bruto armazenado."
- Contradição pré-existente já reconhecida em REQUIREMENTS.md (seção Out of Scope: "Cartão padrão com 1 toque — Defer → v2").
