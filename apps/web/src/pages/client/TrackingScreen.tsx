import { useState, useEffect } from "react";
import { blockLabel } from "@cheirin-de-pao/shared";
import { useNavigate, useSearchParams } from "react-router";
import { useOrderTracking, TodayOrder } from "../../hooks/useOrderTracking";
import { useAuth } from "../../hooks/useAuth";
import { apiFetch } from "../../lib/apiFetch";
import { isPastCutoffForDelivery } from "../../lib/cutoff";
import { Icon, Ic } from "../../components/brand/Icon";
import { BreadMark } from "../../components/brand/BreadMark";
import {
  InlineCancelConfirm,
  inlineCancelBtnStyle,
} from "../../components/client/InlineCancelConfirm";
import {
  MarketOrderCard,
  MarketOrderView,
} from "../../components/client/MarketOrderCard";
import {
  ClientProofViewer,
  ProofCard,
  ProofHistoryBadge,
} from "../../components/client/ClientProofViewer";
import { CRAvatar, CRNote, CRTag } from "../../components/courier/kit";
import type { ClientProofFlags } from "../../lib/clientProof";

interface HistoryOrder {
  id: string;
  status:
    | "SCHEDULED"
    | "SEPARATED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "NOT_DELIVERED"
    | "CANCELLED";
  quantity: number;
  scheduledDate: string;
  deliveryTime?: string;
  slotId?: string;
  type: "SCHEDULED" | "SINGLE";
  createdAt?: string;
  failureText?: string | null;
  /** Selo do comprovante (foto) — só com a função ligada pelo admin, por 90 dias. */
  proof?: ClientProofFlags;
}

/** Foto aberta em tela cheia (C2). */
type ViewerTarget = { kind: "bread" | "market"; id: string; failureText?: string | null };

/** "05:52" no horário de Brasília. */
function brtHour(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** Item da lista única de histórico: pedido de pão ou Cestinha ("Além do Pãozin"). */
type HistoryEntry =
  | {
      kind: "bread";
      id: string;
      dateKey: string;
      createdAt: string;
      order: HistoryOrder;
    }
  | {
      kind: "market";
      id: string;
      dateKey: string;
      createdAt: string;
      order: MarketOrderView;
    };

/** Alvo da confirmação de cancelamento embutida (só uma aberta por vez). */
type CancelTarget = { kind: "bread" | "market"; id: string };

// Casa um pedido ao slot do condomínio: por slotId (Etapa B) com fallback ao horário (legado).
function matchSlot(
  order: { slotId?: string; deliveryTime?: string },
  slots: CondoSlot[],
): CondoSlot | undefined {
  if (order.slotId) {
    const bySlot = slots.find((s) => (s.slotId ?? s.name) === order.slotId);
    if (bySlot) return bySlot;
  }
  return order.deliveryTime
    ? slots.find((s) => s.time === order.deliveryTime)
    : undefined;
}

interface CondoSlot {
  slotId?: string;
  name: string;
  label?: string;
  emoji?: string;
  time: string;
  cutoffTime: string;
  isActive: boolean;
}

// Fallback de rótulos/emoji caso a API não traga label/emoji (slots legados)
const SLOT_LABEL: Record<string, string> = { manha: "manhã", tarde: "tarde" };
const SLOT_EMOJI: Record<string, string> = { manha: "☀️", tarde: "🌙" };

const STATUSES = ["SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

type StepKey = (typeof STATUSES)[number];

const STEPS: { key: StepKey; label: string; desc: string }[] = [
  {
    key: "SCHEDULED",
    label: "Agendado",
    desc: "Pedido confirmado e pãezins reservados",
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Saiu para entrega",
    desc: "O entregador está a caminho do seu condomínio",
  },
  {
    key: "DELIVERED",
    label: "Entregue",
    desc: "Pão fresquinho na sua porta.",
  },
];

// Posição do pedido na timeline. SEPARATED (separado na padaria) ainda é "Agendado" para o
// cliente; NOT_DELIVERED chega ao último passo, que vira "Não entregue". Sem isso os dois
// caíam fora da lista e a timeline aparecia inteira apagada.
function timelineStatus(orderStatus: string): StepKey {
  if (orderStatus === "SEPARATED") return "SCHEDULED";
  if (orderStatus === "NOT_DELIVERED") return "DELIVERED";
  return (STATUSES as readonly string[]).includes(orderStatus)
    ? (orderStatus as StepKey)
    : "SCHEDULED";
}

/**
 * Status para a timeline do cliente (D-7): "Saiu para entrega" só acende depois de o entregador
 * INICIAR a rota. Em rota pelo admin, mas sem a rota iniciada, ainda é "Agendado". Sem o campo
 * (API antiga), vale o status.
 */
export function clientStatus(order: Pick<TodayOrder, "status" | "onTheWayAt">): string {
  if (order.status === "OUT_FOR_DELIVERY" && "onTheWayAt" in order && !order.onTheWayAt) return "SCHEDULED";
  return order.status;
}

function getStepState(
  stepKey: StepKey,
  orderStatus: string,
): "done" | "cur" | "future" {
  const statusIndex = STATUSES.indexOf(timelineStatus(orderStatus));
  const stepIndex = STATUSES.indexOf(stepKey);
  if (stepIndex < statusIndex) return "done";
  if (stepIndex === statusIndex) return "cur";
  return "future";
}

function formatHeroDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dayName = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  const dayNum = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  const monthShort = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(date)
    .replace(".", "");
  return `${dayName.toUpperCase()} · ${dayNum} ${monthShort.toUpperCase()}`;
}

function formatQty(qty: number): string {
  return qty === 1 ? "1 pão" : `${qty} pães`;
}

function formatHistoryDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(dateStr));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface PillProps {
  children: React.ReactNode;
  tone:
    | "good"
    | "neutral"
    | "scheduled"
    | "transit"
    | "delivered"
    | "failed"
    | "cancelled";
  dot?: boolean;
  iconName?: keyof typeof Ic;
  ariaLive?: "polite" | "off";
}

function Pill({ children, tone, dot, iconName, ariaLive }: PillProps) {
  const toneStyles: Record<string, React.CSSProperties> = {
    // tons suaves usados na timeline ("agora")
    good: { background: "var(--color-good-soft)", color: "var(--color-good)" },
    neutral: {
      background: "var(--color-surface-2)",
      color: "var(--color-text-sec)",
    },
    // status do histórico — fundo claro + texto escuro da MESMA família de cor (estilo "agora")
    scheduled: {
      background: "var(--color-surface-2)",
      color: "var(--color-text-sec)",
    },
    transit: {
      background: "var(--color-gold-soft)",
      color: "var(--color-accent)",
    },
    delivered: {
      background: "var(--color-good-soft)",
      color: "var(--color-good)",
    },
    failed: {
      background: "var(--color-warn-soft)",
      color: "var(--color-warn)",
    },
    cancelled: {
      background: "var(--color-surface-2)",
      color: "var(--color-text-ter)",
    },
  };
  const fg = toneStyles[tone].color as string;
  return (
    <div
      aria-live={ariaLive}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 99,
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: 11.5,
        ...toneStyles[tone],
      }}
    >
      {dot && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: fg,
            flexShrink: 0,
          }}
        />
      )}
      {iconName && (
        <Icon
          name={iconName}
          size={13}
          color={fg}
          stroke={2.6}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "OUT_FOR_DELIVERY")
    return (
      <Pill tone="transit" dot>
        A caminho
      </Pill>
    );
  if (status === "DELIVERED")
    return (
      <Pill tone="delivered" iconName="check">
        Entregue
      </Pill>
    );
  if (status === "NOT_DELIVERED")
    return (
      <Pill tone="failed" iconName="x">
        Não entregue
      </Pill>
    );
  if (status === "CANCELLED") return <Pill tone="cancelled">Cancelado</Pill>;
  return (
    <Pill tone="scheduled" iconName="clock">
      Agendado
    </Pill>
  );
}

// Rótulo acessível/curto do status para aria-label.
function statusLabel(status: string): string {
  if (status === "DELIVERED") return "Entregue";
  if (status === "OUT_FOR_DELIVERY") return "A caminho";
  if (status === "NOT_DELIVERED") return "Não entregue";
  if (status === "CANCELLED") return "Cancelado";
  return "Agendado";
}

function HeroCard({
  order,
  isToday,
  slotLabel,
  slotEmoji,
  displayTime,
  place,
}: {
  order: TodayOrder;
  isToday: boolean;
  slotLabel?: string;
  slotEmoji?: string;
  displayTime?: string;
  /** "Residencial Jardins · Bloco 1 · Apto 101" (V-16). */
  place?: string;
}) {
  // Linha de slot + horário previsto. `displayTime` vem do slot ATUAL (dinâmico) quando o
  // slot é reconhecido; senão cai no snapshot do pedido. Avulsos sem slot caem em copy neutra.
  const slotTime = [slotLabel, displayTime ? `previsto ${displayTime}` : null]
    .filter(Boolean)
    .join(" · ");
  // Com o endereço conhecido (V-16): turno na linha de cima e condomínio/bloco/apto embaixo.
  const subtitle = place
    ? [place, displayTime ? `previsto ${displayTime}` : null].filter(Boolean).join(" · ")
    : slotTime || (isToday ? "Entrega no seu condomínio" : "Sua próxima entrega");
  const topLine = `${formatHeroDate(order.scheduledDate)}${place && slotLabel ? ` · ${slotEmoji ? `${slotEmoji} ` : ""}${slotLabel.toUpperCase()}` : ""}`;
  return (
    <div
      style={{
        background: "var(--color-espresso)",
        borderRadius: "var(--radius-card)",
        padding: 20,
        overflow: "hidden",
        position: "relative",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -36,
          right: -20,
          opacity: 0.13,
          pointerEvents: "none",
        }}
      >
        <BreadMark size={150} color="#E3AC3F" />
      </div>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11.5,
          fontWeight: 700,
          color: "#E3AC3F",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          margin: "0 0 6px",
        }}
      >
        {topLine}
      </p>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 30,
          color: "#FAF5EC",
          letterSpacing: "-0.02em",
          margin: 0,
          lineHeight: 1.0,
        }}
      >
        {formatQty(order.quantity)}
      </p>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "#C7B595",
          margin: "4px 0 0",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function Timeline({ order }: { order: TodayOrder }) {
  // Cumprimento da etapa "Entregue" conforme o horário do slot (manhã/tarde/noite).
  const hour = order.deliveryTime
    ? parseInt(order.deliveryTime.split(":")[0], 10)
    : null;
  const greeting =
    hour === null
      ? "Aproveite!"
      : hour < 12
        ? "Bom dia!"
        : hour < 18
          ? "Boa tarde!"
          : "Boa noite!";

  return (
    <div
      role="list"
      style={{ paddingLeft: 6, position: "relative", marginBottom: 18 }}
    >
      {STEPS.map((step, i) => {
        const status = clientStatus(order);
        const state = getStepState(step.key, status);
        const isLast = i === STEPS.length - 1;
        // Último passo de um pedido não entregue: "Não entregue", em vermelho, com X.
        const failed = isLast && order.status === "NOT_DELIVERED";
        const label = failed ? "Não entregue" : step.label;
        const stepColor = failed ? "var(--color-warn)" : "var(--color-accent)";
        const prevDone =
          i > 0 && getStepState(STEPS[i - 1].key, status) === "done";
        const outStep = step.key === "OUT_FOR_DELIVERY";
        const outSince = outStep && order.onTheWayAt ? brtHour(order.onTheWayAt) : null;

        return (
          <div
            key={step.key}
            role="listitem"
            style={{ display: "flex", gap: 16, paddingBottom: isLast ? 0 : 26 }}
          >
            {/* Coluna esquerda: círculo + linha */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 99,
                  background:
                    state !== "future" ? stepColor : "var(--color-surface)",
                  border: `2px solid ${state !== "future" ? stepColor : "var(--color-border)"}`,
                  display: "grid",
                  placeItems: "center",
                  zIndex: 1,
                  flexShrink: 0,
                }}
              >
                {state === "done" && (
                  <Icon
                    name="check"
                    size={18}
                    color="var(--color-app-bg)"
                    stroke={2.6}
                    aria-hidden="true"
                  />
                )}
                {state === "cur" && failed && (
                  <Icon
                    name="x"
                    size={18}
                    color="var(--color-app-bg)"
                    stroke={2.6}
                    aria-hidden="true"
                  />
                )}
                {state === "cur" && !failed && (
                  <div
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: "#FBF3E4",
                    }}
                  />
                )}
                {state === "future" && (
                  <div
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: "transparent",
                    }}
                  />
                )}
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 2.5,
                    flex: 1,
                    minHeight: 38,
                    margin: "2px 0",
                    background: prevDone
                      ? "var(--color-accent)"
                      : "var(--color-border)",
                  }}
                />
              )}
            </div>

            {/* Coluna direita: texto */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 16.5,
                    letterSpacing: "-0.01em",
                    color: failed
                      ? "var(--color-warn)"
                      : state !== "future"
                        ? "var(--color-text)"
                        : "var(--color-text-ter)",
                  }}
                >
                  {label}
                </span>
                {state === "cur" && !failed && (
                  <Pill tone="good" dot ariaLive="polite">
                    agora
                  </Pill>
                )}
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--color-text-sec)",
                  margin: "4px 0 0",
                  lineHeight: 1.45,
                }}
              >
                {failed
                  ? order.failureText
                    ? // "Tentamos entregar às 05:52 — não conseguimos acesso pela portaria."
                      `Tentamos entregar${brtHour(order.failedAt) ? ` às ${brtHour(order.failedAt)}` : ""} — ${order.failureText}.`
                    : "Não conseguimos entregar desta vez. Se precisar, fale com o suporte."
                  : step.key === "DELIVERED"
                    ? `${step.desc} ${greeting}`
                    : outStep && state === "future"
                      ? "Acende quando o entregador sair com o seu pão"
                      : outStep && order.courier
                        ? `${order.courier.firstName} está a caminho do seu condomínio`
                        : step.desc}
              </p>
              {outSince && state !== "future" && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: "var(--color-text-ter)", margin: "4px 0 0", fontWeight: 600 }}>
                  a caminho desde {outSince}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrackingScreen() {
  const navigate = useNavigate();
  const { updateCreditBalance, user } = useAuth();
  const heroPlace = user?.condominiumName
    ? [user.condominiumName, user.block ? blockLabel(user.block) : null, user.apartment ? `Apto ${user.apartment}` : null].filter(Boolean).join(" · ")
    : undefined;
  // fallbackToNext: mostra a próxima entrega agendada mesmo antes da meia-noite
  // (mesmo comportamento do card da Home).
  const { order, isToday } = useOrderTracking({ fallbackToNext: true });
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  // Cestinhas (Além do Pãozin) — entram na MESMA lista de histórico dos pedidos de pão.
  const [marketOrders, setMarketOrders] = useState<MarketOrderView[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [slots, setSlots] = useState<CondoSlot[]>([]);
  // Pedido com a confirmação de cancelamento aberta (null = nenhuma).
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // Foto do comprovante em tela cheia — também aberta pelo aviso "Ver foto" (?comprovante=<id>).
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedProof = searchParams.get("comprovante");
  const [viewer, setViewer] = useState<ViewerTarget | null>(
    linkedProof ? { kind: "bread", id: linkedProof } : null,
  );
  const closeViewer = () => {
    setViewer(null);
    if (searchParams.has("comprovante")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("comprovante");
          return next;
        },
        { replace: true },
      );
    }
  };

  useEffect(() => {
    // Slots do condomínio para resolver o nome real (manhã/tarde) pelo deliveryTime
    apiFetch("/client/condominium/slots")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CondoSlot[]) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]));
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiFetch("/orders/history?days=30");
        if (res.ok) {
          setHistory((await res.json()) as HistoryOrder[]);
        }
      } catch {
        // mantém lista vazia
      } finally {
        setIsLoadingHistory(false);
      }
    };
    void fetchHistory();
  }, []);

  useEffect(() => {
    apiFetch("/market/orders/history")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MarketOrderView[]) =>
        setMarketOrders(Array.isArray(data) ? data : []),
      )
      .catch(() => setMarketOrders([]))
      .finally(() => setIsLoadingMarket(false));
  }, []);

  // Pedidos cancelados aparecem com o pill "Cancelado" (não são mais escondidos).
  const visibleHistory = history;

  const isLoadingList = isLoadingHistory || isLoadingMarket;

  // Lista única: pães + Cestinhas ordenados pela data de entrega (desc) e, no empate, pela
  // criação (desc). Sem seções separadas — o cliente vê tudo em ordem cronológica.
  const entries: HistoryEntry[] = [
    ...visibleHistory.map<HistoryEntry>((o) => ({
      kind: "bread",
      id: o.id,
      dateKey: o.scheduledDate.slice(0, 10),
      createdAt: o.createdAt ?? "",
      order: o,
    })),
    ...marketOrders.map<HistoryEntry>((o) => ({
      kind: "market",
      id: o.id,
      dateKey: o.scheduledDate.slice(0, 10),
      createdAt: o.createdAt ?? "",
      order: o,
    })),
  ].sort(
    (a, b) =>
      b.dateKey.localeCompare(a.dateKey) ||
      b.createdAt.localeCompare(a.createdAt),
  );

  const openCancel = (target: CancelTarget) => {
    setCancelTarget(target);
    setCancelError(null);
  };

  const closeCancel = () => {
    if (isCancelling) return;
    setCancelTarget(null);
    setCancelError(null);
  };

  // Cancela o pedido de pão (pedido único antes do corte): os pães voltam ao saldo.
  const cancelBreadOrder = async (id: string) => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await apiFetch(`/orders/${id}/cancel`, { method: "PATCH" });
      if (res.ok) {
        const result = (await res.json()) as {
          id: string;
          creditBalance: number;
        };
        setHistory((prev) =>
          prev.map((h) =>
            h.id === result.id ? { ...h, status: "CANCELLED" } : h,
          ),
        );
        updateCreditBalance(result.creditBalance);
        setCancelTarget(null);
        return;
      }
      // 422 (corte passou / não cancelável), 404 etc. — mostra a mensagem do servidor.
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setCancelError(
        data?.error ?? "Não foi possível cancelar. Tente novamente.",
      );
    } catch {
      setCancelError("Falha na conexão. Tente novamente.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Cancela a Cestinha: estorna tudo em crédito (inclusive a parte paga em dinheiro).
  const cancelMarketOrder = async (id: string) => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await apiFetch(`/market/orders/${id}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        const updated = (await res.json()) as MarketOrderView;
        setMarketOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
        setCancelTarget(null);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setCancelError(
        data?.error ?? "Não foi possível cancelar. Tente novamente.",
      );
    } catch {
      setCancelError("Erro de conexão. Tente novamente.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Nome do slot (manhã/tarde) cruzando o pedido (por slotId; fallback horário) com os slots
  const heroSlot = order ? matchSlot(order, slots) : undefined;
  const slotLabel = heroSlot
    ? (
        heroSlot.label ??
        SLOT_LABEL[heroSlot.name] ??
        heroSlot.name
      ).toLowerCase()
    : undefined;
  // Horário exibido: do slot ATUAL (dinâmico) quando reconhecido; senão snapshot do pedido.
  const heroTime = heroSlot?.time ?? order?.deliveryTime;

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 56px - env(safe-area-inset-bottom))",
        background: "var(--color-app-bg)",
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 20px 14px",
          gap: 12,
        }}
      >
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/client/home");
            }
          }}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "var(--color-surface-2)",
            border: "none",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} />
        </button>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 21,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Sua entrega
        </h1>
      </div>

      <div style={{ padding: "0 20px 24px" }}>
        {order && (
          <HeroCard
            order={order}
            isToday={isToday}
            slotLabel={slotLabel}
            slotEmoji={heroSlot ? (heroSlot.emoji ?? SLOT_EMOJI[heroSlot.name]) : undefined}
            displayTime={heroTime}
            place={heroPlace}
          />
        )}
        {order && <Timeline order={order} />}

        {/* Comprovante (C2): foto da porta/portaria quando o admin liberou para o cliente. */}
        {order &&
          isToday &&
          order.proof?.available &&
          (order.status === "DELIVERED" || order.status === "NOT_DELIVERED") && (
            <ProofCard
              kind="bread"
              id={order.id}
              onOpen={() =>
                setViewer({ kind: "bread", id: order.id, failureText: order.failureText })
              }
            />
          )}
        {order && isToday && order.proof?.expired && (
          <div style={{ marginBottom: 14 }}>
            <CRNote icon="camera">O comprovante fica disponível por 90 dias.</CRNote>
          </div>
        )}

        {/* Card do entregador (C1) — só depois de a rota começar: foto + primeiro nome, sem telefone. */}
        {order && isToday && order.courier && (order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED") && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "var(--color-surface)",
              borderRadius: 16,
              border: "1px solid var(--color-border-2)",
              marginBottom: 18,
            }}
          >
            <CRAvatar name={order.courier.firstName} photoUrl={order.courier.photoUrl} size={48} />
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--color-text-ter)", margin: "0 0 2px" }}>Seu entregador</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>{order.courier.firstName}</p>
            </div>
            {order.status === "OUT_FOR_DELIVERY" && (
              <CRTag icon="truck" tone="good">
                a caminho
              </CRTag>
            )}
          </div>
        )}
        {order && isToday && clientStatus(order) === "SCHEDULED" && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-text-ter)", textAlign: "center", padding: "4px 20px", lineHeight: 1.45, margin: "0 0 18px" }}>
            Quando o entregador sair com o seu pão, você vê aqui quem vai entregar.
          </p>
        )}

        {/* Histórico — lista única: pedidos de pão + Cestinhas (Além do Pãozin) */}
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "-0.02em",
            color: "var(--color-text)",
            margin: "18px 0 10px",
          }}
        >
          Histórico
        </h2>

        {isLoadingList && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: 64,
                  borderRadius: "var(--radius-card)",
                  background: "var(--color-surface-2)",
                }}
              />
            ))}
          </div>
        )}

        {!isLoadingList && entries.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              paddingTop: 32,
            }}
          >
            <Icon name="clock" size={48} color="var(--color-text-ter)" />
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--color-text-sec)",
                margin: "12px 0 6px",
              }}
            >
              Nenhuma entrega ainda
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--color-text-ter)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Seus pedidos dos últimos 30 dias aparecem aqui. Configure sua
              agenda para começar.
            </p>
          </div>
        )}

        {!isLoadingList && entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((entry) => {
              // Cestinha (Além do Pãozin) — card próprio, mesma lista e mesma confirmação.
              if (entry.kind === "market") {
                const confirming =
                  cancelTarget?.kind === "market" &&
                  cancelTarget.id === entry.id;
                return (
                  <MarketOrderCard
                    key={`market-${entry.id}`}
                    order={entry.order}
                    confirming={confirming}
                    busy={confirming && isCancelling}
                    error={confirming ? cancelError : null}
                    onAskCancel={() =>
                      openCancel({ kind: "market", id: entry.id })
                    }
                    onConfirmCancel={() => void cancelMarketOrder(entry.id)}
                    onBack={closeCancel}
                    onViewPhoto={() =>
                      setViewer({ kind: "market", id: entry.id, failureText: entry.order.failureText })
                    }
                  />
                );
              }

              const o = entry.order;
              const confirming =
                cancelTarget?.kind === "bread" && cancelTarget.id === o.id;
              const dateLabel = formatHistoryDate(o.scheduledDate);
              const matched = matchSlot(o, slots);
              const slotEmoji = matched
                ? (matched.emoji ?? SLOT_EMOJI[matched.name] ?? "")
                : "";
              const slotName2 = matched
                ? (matched.label ?? SLOT_LABEL[matched.name])
                : undefined;
              // Horário do slot ATUAL (dinâmico) quando reconhecido; senão o snapshot do pedido.
              const displayTime = matched?.time ?? o.deliveryTime;
              // "☀️ Manhã · 06:00" — ou só o horário se o slot não for reconhecido
              const slotText = displayTime
                ? `${slotEmoji ? slotEmoji + " " : ""}${slotName2 ? cap(slotName2) + " · " : ""}${displayTime}`
                : null;
              const typeLabel =
                o.type === "SINGLE" ? "Pedido único" : "Agendamento";
              const qtyText = o.quantity === 1 ? "1 pão" : `${o.quantity} pães`;
              // Pedido único ainda agendado pode ser cancelado pelo cliente até o corte.
              // Sem slot reconhecido, deixamos a decisão para o backend (autoritativo).
              const isCancelable =
                o.type === "SINGLE" && o.status === "SCHEDULED";
              const cutoffPassed =
                isCancelable &&
                !!matched &&
                isPastCutoffForDelivery(
                  matched.time,
                  matched.cutoffTime,
                  o.scheduledDate,
                );
              const canCancel = isCancelable && !cutoffPassed;
              return (
                <div
                  key={`bread-${o.id}`}
                  aria-label={`${dateLabel}, ${statusLabel(o.status)}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: 14,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-2)",
                    borderRadius: "var(--radius-card)",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 13, alignItems: "center" }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        background: "var(--color-surface-2)",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        name={o.type === "SINGLE" ? "bag" : "calendar"}
                        size={21}
                        color="var(--color-accent)"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: 700,
                          fontSize: 14.5,
                          color: "var(--color-text)",
                          margin: 0,
                        }}
                      >
                        {dateLabel}
                      </p>
                      {slotText && (
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontWeight: 600,
                            fontSize: 13,
                            color: "var(--color-text-sec)",
                            margin: "2px 0 0",
                          }}
                        >
                          {slotText}
                        </p>
                      )}
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--color-text-ter)",
                          margin: "1px 0 0",
                        }}
                      >
                        {typeLabel} · {qtyText}
                      </p>
                    </div>
                    <StatusPill status={o.status} />
                    <ProofHistoryBadge
                      proof={o.proof}
                      onView={() =>
                        setViewer({ kind: "bread", id: o.id, failureText: o.failureText })
                      }
                    />
                  </div>

                  {canCancel && !confirming && (
                    <button
                      onClick={() => openCancel({ kind: "bread", id: o.id })}
                      style={inlineCancelBtnStyle}
                    >
                      Cancelar pedido
                    </button>
                  )}
                  {confirming && (
                    <InlineCancelConfirm
                      message={
                        o.quantity === 1
                          ? "Cancelar este pedido? O pãozin volta para o seu saldo e você pode usá-lo quando quiser."
                          : `Cancelar este pedido? Os ${o.quantity} pãezins voltam para o seu saldo e você pode usá-los quando quiser.`
                      }
                      error={cancelError}
                      busy={isCancelling}
                      onConfirm={() => void cancelBreadOrder(o.id)}
                      onBack={closeCancel}
                    />
                  )}
                  {cutoffPassed && (
                    <p
                      style={{
                        marginTop: 10,
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        color: "var(--color-text-ter)",
                        lineHeight: 1.4,
                      }}
                    >
                      Cancelamento indisponível — passou do horário de corte
                      deste pedido.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoadingList &&
          entries.some((e) => e.order.proof?.available || e.order.proof?.expired) && (
            <div style={{ marginTop: 12 }}>
              <CRNote icon="camera">O comprovante fica disponível por 90 dias.</CRNote>
            </div>
          )}
      </div>

      {viewer && (
        <ClientProofViewer
          kind={viewer.kind}
          id={viewer.id}
          failureText={viewer.failureText}
          onClose={closeViewer}
        />
      )}
    </div>
  );
}
