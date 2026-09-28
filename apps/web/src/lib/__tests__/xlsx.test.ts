// xlsx.test.ts — o escritor de planilha que substituiu o CSV em todas as telas de relatório.
//
// O que estes testes protegem é o ponto em que a montagem erra de verdade: **as notas empurram o
// cabeçalho para baixo**, e todo índice de formato é relativo a ele. Um off-by-one aqui não quebra
// nada visivelmente — só entrega uma planilha em que a coluna de dinheiro não está formatada como
// dinheiro, ou pior, em que a formatação caiu numa linha de texto.
//
// Também trava a decisão central do módulo: **número vai como NÚMERO**. O CSV entregava tudo como
// texto, e a coluna não somava do outro lado — que era o motivo de trocar o formato.
import { describe, it, expect } from 'vitest'
import { buildWorkbook } from '../xlsx'

describe('buildWorkbook', () => {
  it('põe o cabeçalho na linha 1 quando não há notas', async () => {
    const wb = await buildWorkbook([
      { name: 'Dados', head: ['Produto', 'Total'], rows: [['Pão', 10]] },
    ])
    const ws = wb.getWorksheet('Dados')!
    expect(ws.getRow(1).getCell(1).value).toBe('Produto')
    expect(ws.getRow(2).getCell(1).value).toBe('Pão')
  })

  it('desloca o cabeçalho quando há notas, com uma linha em branco entre elas', async () => {
    const wb = await buildWorkbook([
      {
        name: 'Dados',
        notes: ['Relatório — agosto de 2026', 'ATENÇÃO: período em curso'],
        head: ['Produto', 'Total'],
        rows: [['Pão', 10]],
      },
    ])
    const ws = wb.getWorksheet('Dados')!
    expect(ws.getRow(1).getCell(1).value).toBe('Relatório — agosto de 2026')
    expect(ws.getRow(2).getCell(1).value).toBe('ATENÇÃO: período em curso')
    expect(ws.getRow(3).getCell(1).value).toBeFalsy() // separador
    expect(ws.getRow(4).getCell(1).value).toBe('Produto')
    expect(ws.getRow(5).getCell(1).value).toBe('Pão')
  })

  it('guarda número como NÚMERO, não como texto formatado', async () => {
    const wb = await buildWorkbook([
      { name: 'Dados', head: ['Item', 'Valor'], rows: [['Combo', 25.9]], money: [1] },
    ])
    const cell = wb.getWorksheet('Dados')!.getRow(2).getCell(2)
    expect(cell.value).toBe(25.9)
    expect(typeof cell.value).toBe('number')
  })

  it('aplica o formato na coluna certa, contando a partir do cabeçalho deslocado', async () => {
    const wb = await buildWorkbook([
      {
        name: 'Dados',
        notes: ['Título'],
        head: ['Item', 'Valor', 'Taxa', 'Qtd'],
        rows: [
          ['A', 10, 0.25, 3],
          ['B', 20, 0.5, 4],
        ],
        money: [1],
        percent: [2],
        integer: [3],
      },
    ])
    const ws = wb.getWorksheet('Dados')!
    // notas(1) + branco(1) → cabeçalho na 3, dados em 4 e 5.
    expect(ws.getRow(3).getCell(1).value).toBe('Item')
    for (const r of [4, 5]) {
      expect(ws.getRow(r).getCell(2).numFmt).toBe('R$ #,##0.00')
      expect(ws.getRow(r).getCell(3).numFmt).toBe('0.0%')
      expect(ws.getRow(r).getCell(4).numFmt).toBe('#,##0')
    }
    // A coluna de rótulo NÃO pode ter formato numérico.
    expect(ws.getRow(4).getCell(1).numFmt).toBeUndefined()
    // E a nota, acima do cabeçalho, também não.
    expect(ws.getRow(1).getCell(2).numFmt).toBeUndefined()
  })

  it('escreve o rodapé depois dos dados, separado por uma linha em branco', async () => {
    const wb = await buildWorkbook([
      {
        name: 'Dados',
        head: ['Item', 'Valor'],
        rows: [['A', 1]],
        footer: ['Base de cálculo: custo comprado no período.'],
      },
    ])
    const ws = wb.getWorksheet('Dados')!
    expect(ws.getRow(2).getCell(1).value).toBe('A')
    expect(ws.getRow(3).getCell(1).value).toBeFalsy()
    expect(ws.getRow(4).getCell(1).value).toBe('Base de cálculo: custo comprado no período.')
  })

  it('sanitiza o nome da aba — o Excel recusa []:*?/\\ e trunca em 31 caracteres', async () => {
    const wb = await buildWorkbook([
      { name: 'Caixa: entradas/saídas [2026]', head: ['A'], rows: [] },
      { name: 'Um nome absurdamente longo que passa de trinta e um', head: ['A'], rows: [] },
    ])
    const names = wb.worksheets.map((w) => w.name)
    expect(names[0]).not.toMatch(/[[\]:*?/\\]/)
    expect(names[1].length).toBeLessThanOrEqual(31)
  })

  it('nomeia a aba sozinho quando o nome fica vazio após a sanitização', async () => {
    const wb = await buildWorkbook([{ name: '///', head: ['A'], rows: [] }])
    expect(wb.worksheets[0].name).toBe('Planilha 1')
  })

  it('congela o cabeçalho na linha certa', async () => {
    const wb = await buildWorkbook([
      { name: 'Dados', notes: ['t'], head: ['A'], rows: [['x']] },
    ])
    expect(wb.getWorksheet('Dados')!.views[0]).toMatchObject({ state: 'frozen', ySplit: 3 })
  })

  it('aceita várias abas, cada uma com o seu próprio deslocamento', async () => {
    const wb = await buildWorkbook([
      { name: 'Sem notas', head: ['A', 'V'], rows: [['x', 1]], money: [1] },
      { name: 'Com notas', notes: ['n1', 'n2'], head: ['A', 'V'], rows: [['y', 2]], money: [1] },
    ])
    expect(wb.worksheets).toHaveLength(2)
    expect(wb.getWorksheet('Sem notas')!.getRow(2).getCell(2).numFmt).toBe('R$ #,##0.00')
    // 2 notas + branco → cabeçalho na 4, dado na 5.
    expect(wb.getWorksheet('Com notas')!.getRow(5).getCell(2).numFmt).toBe('R$ #,##0.00')
  })

  it('sobrevive a uma aba sem linha nenhuma', async () => {
    const wb = await buildWorkbook([
      { name: 'Vazia', head: ['A', 'V'], rows: [], money: [1], footer: ['nada no período'] },
    ])
    const ws = wb.getWorksheet('Vazia')!
    expect(ws.getRow(1).getCell(1).value).toBe('A')
    expect(ws.getRow(3).getCell(1).value).toBe('nada no período')
  })

  it('escreve o arquivo de fato — um buffer XLSX com a assinatura de ZIP', async () => {
    const wb = await buildWorkbook([
      { name: 'Dados', head: ['Item', 'Valor'], rows: [['A', 1.5]], money: [1] },
    ])
    const buf = new Uint8Array(await wb.xlsx.writeBuffer())
    // "PK\x03\x04" — todo .xlsx é um zip; sem isso o Excel nem abre.
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(buf.byteLength).toBeGreaterThan(1000)
  })
})
