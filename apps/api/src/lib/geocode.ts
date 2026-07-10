// geocode.ts — geocodificação de endereços via Nominatim (OpenStreetMap).
//
// Usado para:
//  - persistir lat/lng do condomínio ao criar/editar (admin), e
//  - fallback ao vivo na rota do entregador quando o condomínio ainda não tem coords.
//
// Política do Nominatim: 1 req/s e User-Agent identificável (obrigatório).

export interface Coords {
  lat: number
  lng: number
}

export interface AddressLike {
  street: string
  number: string
  complement?: string | null
  city: string
  state: string
  zip: string
}

/**
 * Monta a query de geocodificação a partir do endereço estruturado. Usa o endereço
 * COMPLETO (rua, número, cidade, estado, CEP, Brasil) — só "rua, número" não resolve.
 */
export function addressToQuery(a: AddressLike): string {
  return [`${a.street}, ${a.number}`, a.city, a.state, a.zip, 'Brasil']
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

/**
 * Geocodifica uma query textual. Retorna null em qualquer falha (rede, vazio, parse) —
 * nunca lança, para não derrubar o fluxo que a chama.
 */
export async function geocodeAddress(query: string): Promise<Coords | null> {
  if (!query.trim()) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CheirimdePao-app/1.0 (contato@cheirindepao.com.br)' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

export interface GeocodeResult extends Coords {
  /** true quando só resolveu a nível de cidade (centro) — impreciso para entrega. */
  approximate: boolean
}

/**
 * Geocodifica com cadeia de fallback (cobertura ruim do OSM em cidades menores):
 *   1. endereço completo (preciso)
 *   2. rua + cidade + UF (preciso, sem número/CEP)
 *   3. cidade + UF (APROXIMADO — centro da cidade)
 * Retorna null se nem a cidade resolver. NÃO usa CEP como texto livre (devolve lixo).
 */
export async function geocodeWithFallback(a: AddressLike): Promise<GeocodeResult | null> {
  const full = await geocodeAddress(addressToQuery(a))
  if (full) return { ...full, approximate: false }

  if (a.street && a.city) {
    const street = await geocodeAddress([a.street, a.city, a.state, 'Brasil'].filter(Boolean).join(', '))
    if (street) return { ...street, approximate: false }
  }

  if (a.city) {
    const city = await geocodeAddress([a.city, a.state, 'Brasil'].filter(Boolean).join(', '))
    if (city) return { ...city, approximate: true }
  }

  return null
}
