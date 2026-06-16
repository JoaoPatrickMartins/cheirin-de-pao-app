import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../brand/Icon';
function SortableCondo({ condo, courierId }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
        id: `${courierId}:${condo.condominiumId}`,
    });
    return (_jsxs("div", { ref: setNodeRef, ...attributes, ...listeners, style: {
            opacity: isDragging ? 0.5 : 1,
            transform: CSS.Transform.toString(transform),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 0',
            cursor: 'grab',
            touchAction: 'none',
        }, children: [_jsx("span", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'var(--color-text-ter)',
                }, children: condo.condominiumName }), _jsxs("span", { style: {
                    fontFamily: 'var(--font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                }, children: [condo.quantity, " p\u00E3es"] })] }));
}
export function DeliveryDivisionCard({ assignments, onAssignmentsChange, onApprove, isApproved, isApproving, }) {
    const [activeId, setActiveId] = useState(null);
    const [approveError, setApproveError] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }));
    function findOwner(dragId) {
        const [courierId, condominiumId] = dragId.split(':');
        return { courierId, condominiumId };
    }
    function handleDragStart(event) {
        setActiveId(String(event.active.id));
    }
    function handleDragEnd(event) {
        setActiveId(null);
        const { active, over } = event;
        if (!over)
            return;
        const activeStr = String(active.id);
        const overStr = String(over.id);
        // over pode ser um courierId (drop zone) ou um item id (courierId:condominiumId)
        const targetCourierId = overStr.includes(':') ? overStr.split(':')[0] : overStr;
        const { courierId: sourceCourierId, condominiumId } = findOwner(activeStr);
        if (sourceCourierId === targetCourierId)
            return;
        const next = assignments.map((a) => {
            if (a.courierId === sourceCourierId) {
                return { ...a, condos: a.condos.filter((c) => c.condominiumId !== condominiumId) };
            }
            if (a.courierId === targetCourierId) {
                const condo = assignments
                    .find((a2) => a2.courierId === sourceCourierId)
                    ?.condos.find((c) => c.condominiumId === condominiumId);
                if (!condo)
                    return a;
                return { ...a, condos: [...a.condos, condo] };
            }
            return a;
        });
        onAssignmentsChange(next);
    }
    function totalForCourier(a) {
        return a.condos.reduce((sum, c) => sum + c.quantity, 0);
    }
    async function handleApprove() {
        setApproveError(false);
        try {
            await onApprove();
        }
        catch {
            setApproveError(true);
        }
    }
    // Todos os IDs sortáveis (courierId:condominiumId) + courierId como drop zone
    const allSortableIds = assignments.flatMap((a) => a.condos.map((c) => `${a.courierId}:${c.condominiumId}`));
    const activeCondoItem = activeId
        ? (() => {
            const { courierId, condominiumId } = findOwner(activeId);
            return assignments.find((a) => a.courierId === courierId)?.condos.find((c) => c.condominiumId === condominiumId) ?? null;
        })()
        : null;
    return (_jsxs("div", { style: {
            background: 'var(--color-surface)',
            borderRadius: 22,
            border: isApproved
                ? '1.5px solid var(--color-border-2)'
                : '1.5px solid var(--color-accent)',
            padding: 16,
            transition: 'border-color 0.2s ease',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 14,
                }, children: [_jsx(Icon, { name: "spark", size: 20, color: "var(--color-accent)", stroke: 2, "aria-hidden": "true" }), _jsx("span", { style: {
                            flex: 1,
                            fontFamily: 'var(--font-body)',
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                        }, children: "Divis\u00E3o sugerida" }), isApproved && (_jsxs("span", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--color-good-soft)',
                            color: 'var(--color-good)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            fontWeight: 700,
                        }, children: [_jsx(Icon, { name: "check", size: 13, color: "var(--color-good)", stroke: 2.6, "aria-hidden": "true" }), "Aprovada"] }))] }), _jsxs(DndContext, { sensors: sensors, onDragStart: handleDragStart, onDragEnd: handleDragEnd, children: [_jsx(SortableContext, { items: allSortableIds, strategy: verticalListSortingStrategy, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: assignments.map((assignment) => (_jsxs("div", { id: assignment.courierId, style: {
                                    background: 'var(--color-surface-2)',
                                    borderRadius: 14,
                                    padding: 12,
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            marginBottom: assignment.condos.length > 0 ? 8 : 0,
                                        }, children: [_jsx("div", { style: {
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: '50%',
                                                    background: 'var(--color-surface)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }, children: _jsx(Icon, { name: "user", size: 18, color: "var(--color-accent)", stroke: 2, "aria-hidden": "true" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: 'var(--color-text)',
                                                            margin: 0,
                                                            lineHeight: 1.2,
                                                        }, children: assignment.courierName }), _jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 12,
                                                            color: 'var(--color-text-ter)',
                                                            margin: '2px 0 0',
                                                            lineHeight: 1.2,
                                                        }, children: assignment.condos.length > 0
                                                            ? assignment.condos.map((c) => c.condominiumName).join(', ')
                                                            : 'Sem condomínios atribuídos' })] }), _jsx("span", { style: {
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: 15,
                                                    fontWeight: 800,
                                                    color: 'var(--color-gold)',
                                                    flexShrink: 0,
                                                }, children: totalForCourier(assignment) })] }), assignment.condos.length > 0 && (_jsx("div", { style: {
                                            borderTop: '1px solid var(--color-border-2)',
                                            paddingTop: 6,
                                        }, children: assignment.condos.map((condo) => (_jsx(SortableCondo, { condo: condo, courierId: assignment.courierId }, condo.condominiumId))) }))] }, assignment.courierId))) }) }), _jsx(DragOverlay, { children: activeCondoItem ? (_jsx("div", { style: {
                                background: 'var(--color-surface)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                border: '1.5px solid var(--color-accent)',
                                fontFamily: 'var(--font-body)',
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                            }, children: activeCondoItem.condominiumName })) : null })] }), approveError && (_jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    color: 'var(--color-accent)',
                    margin: '10px 0 0',
                    textAlign: 'center',
                }, children: "Falha ao salvar. Tente novamente." })), !isApproved && (_jsxs("button", { onClick: () => void handleApprove(), disabled: isApproving, style: {
                    width: '100%',
                    marginTop: 12,
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    border: 'none',
                    borderRadius: 14,
                    background: 'var(--color-gold)',
                    color: '#1E1207',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: isApproving ? 'wait' : 'pointer',
                    opacity: isApproving ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                }, children: [_jsx(Icon, { name: "check", size: 16, color: "#1E1207", stroke: 2.5, "aria-hidden": "true" }), isApproving ? 'Aprovando...' : 'Aprovar divisão'] }))] }));
}
