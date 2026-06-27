// viacep.ts — consulta de endereço por CEP via ViaCEP (gratuito, sem chave, com CORS).
// Usado para autopreencher rua/cidade/UF nos formulários de endereço (condomínio, fornecedor).

export interface CepAddress {
  street: string
  city: string
  uf: string
}

/**
 * Consulta o ViaCEP pelo CEP (com ou sem máscara). Retorna o endereço encontrado ou
 * `null` quando o CEP é incompleto, inválido/inexistente, ou há falha de rede — nunca
 * lança, para o formulário tratar como "preencher manualmente".
 */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      erro?: boolean
      logradouro?: string
      localidade?: string
      uf?: string
    }
    if (data.erro) return null
    return {
      street: data.logradouro ?? '',
      city: data.localidade ?? '',
      uf: (data.uf ?? '').toUpperCase().slice(0, 2),
    }
  } catch {
    return null
  }
}
