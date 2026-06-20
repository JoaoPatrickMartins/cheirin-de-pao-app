import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentPolling } from '../../hooks/usePaymentPolling';
export function PixWaitingScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const { updateCreditBalance } = useAuth();
    const state = location.state;
    if (!state?.paymentId) {
        navigate('/client/creditos', { replace: true });
        return null;
    }
    const { paymentId, qrCodeBase64, qrCode, comboQuantity } = state;
    return (_jsx(PixWaitingContent, { paymentId: paymentId, qrCodeBase64: qrCodeBase64, qrCode: qrCode, comboQuantity: comboQuantity, onCreditUpdate: updateCreditBalance, onNavigate: navigate }));
}
function PixWaitingContent({ paymentId, qrCodeBase64, qrCode, comboQuantity, onCreditUpdate, onNavigate, }) {
    const [copied, setCopied] = useState(false);
    const [isApproved, setIsApproved] = useState(false);
    const [isRejected, setIsRejected] = useState(false);
    const handleApproved = (creditBalance) => {
        onCreditUpdate(creditBalance);
        setIsApproved(true);
        onNavigate('/client/creditos/sucesso', { state: { quantity: comboQuantity } });
    };
    const handleRejected = () => {
        setIsRejected(true);
    };
    const { isTimeout } = usePaymentPolling(isApproved || isRejected ? null : paymentId, handleApproved, handleRejected);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(qrCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            // clipboard unavailable
        }
    };
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
        }, children: [_jsx("style", { children: `@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }` }), _jsx("h1", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 21,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.02em',
                    margin: 0,
                    alignSelf: 'flex-start',
                }, children: "Pix" }), _jsx("img", { src: `data:image/png;base64,${qrCodeBase64}`, width: 200, height: 200, style: { borderRadius: 12 }, alt: "QR Code PIX" }), _jsxs("div", { style: { width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx("p", { style: {
                            fontFamily: 'monospace',
                            fontSize: 12,
                            wordBreak: 'break-all',
                            background: 'var(--color-surface-2)',
                            borderRadius: 10,
                            padding: 12,
                            margin: 0,
                            color: 'var(--color-text-sec)',
                        }, children: qrCode }), _jsx("button", { onClick: handleCopy, style: {
                            width: '100%',
                            minHeight: 44,
                            borderRadius: 'var(--radius-btn)',
                            border: '1.5px solid var(--color-border)',
                            background: copied ? 'var(--color-good-soft)' : 'var(--color-surface)',
                            color: copied ? 'var(--color-good)' : 'var(--color-text)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            transition: 'all .15s',
                        }, children: copied ? 'Copiado!' : 'Copiar código' })] }), isRejected ? (_jsxs("div", { style: {
                    width: '100%',
                    background: 'var(--color-surface-2)',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    alignItems: 'center',
                }, children: [_jsx("p", { style: { fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text)', margin: 0, textAlign: 'center' }, children: "Pagamento n\u00E3o aprovado. Isso pode ter sido um erro tempor\u00E1rio do banco. Tente novamente." }), _jsx("button", { onClick: () => onNavigate('/client/creditos'), style: {
                            minHeight: 44,
                            padding: '10px 24px',
                            borderRadius: 'var(--radius-btn)',
                            border: 'none',
                            background: 'var(--color-accent)',
                            color: 'var(--color-primary-btn-text)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                        }, children: "Tentar novamente" })] })) : isTimeout ? (_jsxs("div", { style: {
                    width: '100%',
                    background: 'var(--color-gold-soft)',
                    border: '1.5px solid var(--color-gold)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }, children: [_jsx("p", { style: { fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', margin: 0 }, children: "N\u00E3o detectamos o pagamento ainda. Verifique o app do banco e tente novamente." }), _jsx("button", { onClick: () => onNavigate('/client/home'), style: {
                            minHeight: 44,
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-btn)',
                            border: 'none',
                            background: 'var(--color-gold)',
                            color: 'var(--color-espresso)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            alignSelf: 'flex-start',
                        }, children: "Verificar mais tarde" })] })) : (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                }, children: [_jsx("div", { style: {
                            width: 32,
                            height: 32,
                            border: '3px solid var(--color-gold-soft)',
                            borderTopColor: 'var(--color-gold)',
                            borderRadius: '50%',
                            animation: 'spin 800ms linear infinite',
                        } }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 14,
                            color: 'var(--color-text-sec)',
                            margin: 0,
                        }, children: "Aguardando pagamento..." })] }))] }));
}
