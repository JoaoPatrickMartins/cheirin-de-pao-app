import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CardPayment } from '@mercadopago/sdk-react';
import { apiFetch } from '../../lib/apiFetch';
export function CardPaymentScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state ?? { amount: 0 };
    const { comboId, customQuantity, amount } = state;
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const handleSubmit = async (formData) => {
        setError(null);
        try {
            // O Brick coleta dados do pagador em formData.payer (e-mail + identification/CPF) —
            // encaminhamos para o backend. Em teste, o e-mail deve ser diferente do da conta MP.
            const payer = formData.payer;
            const res = await apiFetch('/payments/card', {
                method: 'POST',
                body: JSON.stringify({
                    token: formData.token,
                    installments: formData.installments,
                    issuerId: formData.issuer_id,
                    paymentMethodId: formData.payment_method_id,
                    payerEmail: payer?.email,
                    payerIdentification: payer?.identification,
                    comboId,
                    customQuantity,
                }),
            });
            if (res.ok) {
                // fire-and-forget: salvar token para compra recorrente (D-06)
                apiFetch('/users/me/card-token', {
                    method: 'PUT',
                    body: JSON.stringify({ token: formData.token }),
                }).catch(() => { });
                const comboQty = customQuantity ?? 1;
                navigate('/client/creditos/sucesso', { state: { quantity: comboQty } });
            }
            else {
                const err = (await res.json());
                setError(err.error ?? 'Erro no pagamento. Tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
    };
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("button", { onClick: () => navigate('/client/creditos'), style: {
                            minHeight: 44,
                            width: 44,
                            borderRadius: 'var(--radius-btn)',
                            border: '1.5px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            cursor: 'pointer',
                            fontSize: 18,
                        }, children: "\u2190" }), _jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 21,
                            color: 'var(--color-text)',
                            letterSpacing: '-0.02em',
                            margin: 0,
                        }, children: "Pagamento com cart\u00E3o" })] }), _jsx("p", { style: { fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: 0 }, children: "Pagamento processado com seguran\u00E7a pelo Mercado Pago" }), isLoading && (_jsx("p", { style: { fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)' }, children: "Carregando formul\u00E1rio de pagamento..." })), error && (_jsx("p", { style: { fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-accent)' }, children: error })), _jsx("div", { style: { borderRadius: 16, maxWidth: 390 }, children: _jsx(CardPayment, { initialization: { amount }, onSubmit: handleSubmit, onError: () => setError('Erro ao carregar o formulário. Recarregue a página e tente novamente.'), onReady: () => setIsLoading(false) }) })] }));
}
