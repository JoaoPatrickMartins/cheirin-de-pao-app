---
phase: 06-courier-app
plan: "03"
subsystem: frontend-courier-map
tags:
  - courier
  - react-leaflet
  - leaflet
  - mapa
  - osm
  - frontend

dependency_graph:
  requires:
    - 06-01  # backend courier (GET /courier/orders/today retorna geometry + lat/lng dos condos)
    - 06-02  # CourierScreen com placeholder da aba Rota + react-leaflet instalado
  provides:
    - courier-map-component     # CourierMap com TileLayer OSM, DivIcon numerado, Polyline, FitBounds
    - courier-route-view        # CourierRouteView: mapa + lista de paradas com hora estimada
    - leaflet-css-in-main       # import leaflet/dist/leaflet.css antes de globals.css em main.tsx
  affects: []

tech_stack:
  added:
    - react-leaflet ^5.0.0 (adicionado ao package.json do workspace web)
    - leaflet ^1.9.4 (adicionado ao package.json do workspace web)
    - "@types/leaflet" ^1.9.21 (adicionado ao package.json do workspace web)
  patterns:
    - CourierMap usa L.DivIcon com className vazio para evitar fundo branco padrão do Leaflet (Pitfall 4)
    - FitBounds como componente filho usando useMap hook (API react-leaflet v5 — não ref no MapContainer)
    - Graceful degradation via route === null exibe mensagem sem bloquear aba Lista (Pitfall 7)
    - Hora estimada calculada acumulando durationMin/condos * index desde hora atual

key_files:
  created:
    - apps/web/src/components/courier/CourierMap.tsx
    - apps/web/src/pages/courier/CourierRouteView.tsx
  modified:
    - apps/web/src/main.tsx       # import leaflet/dist/leaflet.css antes de globals.css
    - apps/web/src/pages/courier/CourierScreen.tsx  # substituir placeholder por CourierRouteView
    - apps/web/package.json       # adicionar leaflet, react-leaflet, @types/leaflet

decisions:
  - "DivIcon com className vazio elimina fundo branco do leaflet-div-icon (Pitfall 4) e o problema de icon path no Vite simultaneamente"
  - "FitBounds via useMap hook (filho do MapContainer) — API correta para react-leaflet v5"
  - "Tooltip de distância como overlay absoluto fora do MapContainer (zIndex 1000) para não interferir com eventos do mapa"
  - "Filtrar condos com lat null antes de construir waypoints — previne NaN nas coordenadas do Marker"
  - "Hora estimada: somar durationMin/condos * index à hora atual — aproximação simples adequada para MVP"

metrics:
  duration: "~78s (~2min)"
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 06 Plan 03: Mapa Leaflet para Aba Rota do Courier Summary

**One-liner:** Aba Rota do entregador implementada com react-leaflet 5, TileLayer OpenStreetMap, marcadores DivIcon numerados dourados, polyline tracejada gold, FitBounds automático e lista de paradas com hora estimada — substituindo o placeholder do Plano 02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Importar leaflet CSS em main.tsx + criar CourierMap com react-leaflet | 99ffbc1 | main.tsx, CourierMap.tsx, package.json |
| 2 | CourierRouteView + integração em CourierScreen (substituir placeholder) | ae12904 | CourierRouteView.tsx, CourierScreen.tsx |

## What Was Built

### CourierMap (apps/web/src/components/courier/CourierMap.tsx)

Componente principal do mapa com:
- **MapContainer** com `aria-label="Mapa de rota do entregador"` e `zoomControl={false}`
- **TileLayer** com tiles OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) e attribution
- **Polyline** dourada tracejada (`color="#E3AC3F"`, `weight=4`, `dashArray="2 9"`, `lineCap="round"`)
- **Marker** com `L.divIcon` numerado espresso/gold — `className: ''` obrigatório (Pitfall 4)
- **FitBounds** componente filho que usa `useMap()` hook para `map.fitBounds` com padding [20, 20]
- **Tooltip de distância** como overlay absoluto `bottom: 12, left: 12, zIndex: 1000` com "~X km · N paradas"

### CourierRouteView (apps/web/src/pages/courier/CourierRouteView.tsx)

Sub-view da aba Rota com:
- **Estado route === null**: card com "Rota indisponível" + instrução para usar aba Lista (Pitfall 7)
- **Estado route !== null**: mapa CourierMap + label "ORDEM DE PARADAS" + lista de condomínios
- **Filtro de condos**: `condos.filter(c => c.lat !== null && c.lng !== null)` antes de construir waypoints
- **Lista de paradas**: badge 32×32px dourado numerado, nome do condomínio, "N paradas", hora estimada
- **Hora estimada**: acumulada por índice (`durationMin / condos.length * index`) desde hora local atual

### CourierScreen (apps/web/src/pages/courier/CourierScreen.tsx)

- Substituído placeholder "Mapa disponível em breve" por `<CourierRouteView condos={data.condos} route={data.route} />`
- Import de `CourierRouteView` adicionado

### main.tsx (apps/web/src/main.tsx)

- `import 'leaflet/dist/leaflet.css'` inserido como **primeira linha** antes de fontes e globals.css
- Ordem crítica: CSS do Leaflet deve preceder os estilos do app para não sobrescrever controles do mapa

## Security Threats Addressed

| Threat ID | Mitigação Implementada |
|-----------|----------------------|
| T-06-10 | geometry passada diretamente ao Polyline sem reprocessar — backend já converteu [lng,lat] para [lat,lng] |
| T-06-11 | route: null → "Rota indisponível" sem bloquear aba Lista — entregador confirma todas as paradas normalmente |

## Deviations from Plan

None — plano executado exatamente conforme especificado.

**Nota:** package.json do worktree foi atualizado com leaflet/react-leaflet/@types/leaflet (os pacotes estavam instalados no repo principal pelo Plano 02 mas não no worktree isolado — correção automática pela Regra 3).

## Known Stubs

None — aba Rota está totalmente funcional:
- `CourierMap` renderiza mapa OSM real com tiles, marcadores DivIcon e Polyline
- `CourierRouteView` consome dados reais do backend (geometry + lat/lng dos condos)
- `CourierScreen` delega para `CourierRouteView` com dados completos da API

## Threat Flags

None — nenhuma nova superfície de segurança além do que está no threat_model do plano.

## Self-Check: PASSED

### Arquivos criados
- [x] apps/web/src/components/courier/CourierMap.tsx
- [x] apps/web/src/pages/courier/CourierRouteView.tsx

### Arquivos modificados
- [x] apps/web/src/main.tsx (leaflet CSS como primeira importação)
- [x] apps/web/src/pages/courier/CourierScreen.tsx (CourierRouteView no lugar do placeholder)
- [x] apps/web/package.json (leaflet, react-leaflet, @types/leaflet)

### Commits
- [x] 99ffbc1 — feat(06-03): importar leaflet CSS em main.tsx + criar CourierMap com react-leaflet
- [x] ae12904 — feat(06-03): CourierRouteView + integração em CourierScreen (substituir placeholder)

### Acceptance criteria
- [x] main.tsx contém `import 'leaflet/dist/leaflet.css'` em posição anterior ao import de globals.css
- [x] CourierMap.tsx contém `className: ''` no L.divIcon (previne Pitfall 4)
- [x] CourierMap.tsx usa `useMap()` no FitBounds (API react-leaflet v5)
- [x] CourierMap.tsx não contém `L.Icon` nem `iconUrl` (usa apenas DivIcon)
- [x] CourierMap.tsx contém `aria-label="Mapa de rota do entregador"` no MapContainer
- [x] CourierScreen.tsx importa e renderiza CourierRouteView na aba Rota (não o placeholder)
- [x] CourierRouteView.tsx renderiza "Rota indisponível" quando route === null
- [x] CourierRouteView.tsx filtra condos com lat/lng null antes de passar para CourierMap
- [x] CourierRouteView.tsx badges dourados: fundo '#E3AC3F', cor '#1E1207'
- [x] `npm run typecheck --workspace=apps/web` — código 0
- [x] `npm run build --workspace=apps/web` — código 0 (build sem erros de bundle)
