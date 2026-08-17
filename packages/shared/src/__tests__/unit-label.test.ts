import { describe, it, expect } from 'vitest'
import { blockLabel, formatUnit, compareUnits, COMPLEMENT_MAX_LENGTH } from '../unit-label'

describe('blockLabel', () => {
  it('prefixa "Bloco" quando o valor é só o identificador', () => {
    expect(blockLabel('A')).toBe('Bloco A')
    expect(blockLabel('1 ou A')).toBe('Bloco 1 ou A')
  })

  it('não duplica a palavra quando o valor já a contém', () => {
    expect(blockLabel('Bloco 2')).toBe('Bloco 2')
    expect(blockLabel('bloco 2')).toBe('bloco 2')
    expect(blockLabel('Bl 2')).toBe('Bl 2')
  })

  it('devolve string vazia para bloco ausente', () => {
    expect(blockLabel('')).toBe('')
    expect(blockLabel(null)).toBe('')
    expect(blockLabel(undefined)).toBe('')
    // Travessão é a CHAVE do grupo "sem bloco" em algumas telas — não vira "Bloco —".
    expect(blockLabel('—')).toBe('')
  })

  it('usa "Bl" na forma compacta', () => {
    expect(blockLabel('A', true)).toBe('Bl A')
  })
})

describe('formatUnit', () => {
  const full = { block: 'A', complement: 'Lado B', apartment: '102' }

  it('monta bloco · complemento · apartamento', () => {
    expect(formatUnit(full)).toBe('Bloco A · Lado B · Apto 102')
  })

  it('omite as partes ausentes sem deixar separador solto', () => {
    expect(formatUnit({ block: 'A', apartment: '102' })).toBe('Bloco A · Apto 102')
    expect(formatUnit({ complement: 'Lado B', apartment: '102' })).toBe('Lado B · Apto 102')
    expect(formatUnit({ apartment: '102' })).toBe('Apto 102')
  })

  it('marca apartamento ausente com travessão por padrão', () => {
    expect(formatUnit({ block: 'A' })).toBe('Bloco A · Apto —')
  })

  it('com emptyApartment vazio, remove o segmento do apartamento inteiro', () => {
    // Sem isso a linha do entregador imprimiria um "Apto " solto.
    expect(formatUnit({ block: 'A', complement: 'Lado B' }, { emptyApartment: '' })).toBe('Bloco A · Lado B')
    expect(formatUnit({}, { emptyApartment: '' })).toBe('')
  })

  it('respeita os estilos de bloco', () => {
    expect(formatUnit(full, { block: 'compact' })).toBe('Bl A · Lado B · Apto 102')
    expect(formatUnit(full, { block: 'bare' })).toBe('A · Lado B · Apto 102')
    // Lista já agrupada por bloco: o bloco some, o complemento FICA (varia dentro do bloco).
    expect(formatUnit(full, { block: 'omit' })).toBe('Lado B · Apto 102')
  })

  it('aceita separador próprio antes do apartamento (linha da rota)', () => {
    expect(formatUnit(full, { block: 'bare', apartmentSeparator: ' — ' })).toBe('A · Lado B — Apto 102')
  })

  it('ignora espaços em branco puros', () => {
    expect(formatUnit({ block: '  ', complement: '   ', apartment: '102' })).toBe('Apto 102')
  })

  it('permite rótulo de apartamento alternativo ou nenhum', () => {
    expect(formatUnit(full, { apartmentLabel: 'Ap' })).toBe('Bloco A · Lado B · Ap 102')
    expect(formatUnit(full, { block: 'compact', apartmentLabel: '' })).toBe('Bl A · Lado B · 102')
  })
})

describe('compareUnits', () => {
  it('ordena bloco → complemento → apartamento', () => {
    const stops = [
      { block: 'A', complement: 'Lado B', apartment: '101' },
      { block: 'A', complement: 'Lado A', apartment: '102' },
      { block: 'A', complement: 'Lado A', apartment: '101' },
      { block: 'B', complement: '', apartment: '1' },
    ]
    expect([...stops].sort(compareUnits).map((s) => `${s.block}${s.complement}${s.apartment}`)).toEqual([
      'ALado A101',
      'ALado A102',
      'ALado B101',
      'B1',
    ])
  })

  it('agrupa os lados em vez de zigue-zaguear entre eles', () => {
    // Este é o motivo do complemento entrar na ordenação: sem ele o entregador
    // alternaria Lado A → Lado B → Lado A a cada apartamento.
    const stops = [
      { block: 'A', complement: 'Lado A', apartment: '101' },
      { block: 'A', complement: 'Lado B', apartment: '102' },
      { block: 'A', complement: 'Lado A', apartment: '103' },
    ]
    expect([...stops].sort(compareUnits).map((s) => s.complement)).toEqual(['Lado A', 'Lado A', 'Lado B'])
  })

  it('compara números por valor, não por texto', () => {
    const stops = [{ apartment: '101' }, { apartment: '20' }]
    expect([...stops].sort(compareUnits).map((s) => s.apartment)).toEqual(['20', '101'])
  })

  it('trata ausente e vazio como iguais', () => {
    expect(compareUnits({ block: null, apartment: '1' }, { block: '', apartment: '1' })).toBe(0)
  })
})

describe('COMPLEMENT_MAX_LENGTH', () => {
  it('cabe um "Lado A" e sobra pouco — é subbloco, não endereço livre', () => {
    expect(COMPLEMENT_MAX_LENGTH).toBe(10)
    expect('Lado A'.length).toBeLessThanOrEqual(COMPLEMENT_MAX_LENGTH)
  })
})
