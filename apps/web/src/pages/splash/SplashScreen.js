import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { BreadMark } from '../../components/brand/BreadMark';
import { Icon } from '../../components/brand/Icon';
export function SplashScreen() {
    const { isInstallable, isIOS, isStandalone, triggerInstall } = useInstallPrompt();
    const [showIOSSheet, setShowIOSSheet] = useState(false);
    const handleCTA = () => {
        if (isInstallable) {
            triggerInstall();
        }
        else if (isIOS && !isStandalone) {
            setShowIOSSheet(true);
        }
    };
    return (_jsxs("div", { className: "min-h-screen flex flex-col items-center px-5 relative overflow-hidden", style: { backgroundColor: '#1E1207' }, children: [_jsx("div", { "aria-hidden": "true", style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 256,
                    pointerEvents: 'none',
                    background: 'radial-gradient(ellipse at 50% 0%, rgba(227,172,63,0.15), transparent)',
                } }), _jsx("div", { style: {
                    width: 132,
                    height: 132,
                    borderRadius: '30%',
                    backgroundColor: '#160C04',
                    boxShadow: 'var(--shadow-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 64,
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1,
                }, children: _jsx(BreadMark, { size: 86, color: "#E3AC3F", reduced: false }) }), _jsx("h1", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 32,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    color: '#FBF3E4',
                    marginTop: 20,
                    position: 'relative',
                    zIndex: 1,
                }, children: "Cheirin de P\u00E3o" }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: '0.26em',
                    color: '#E3AC3F',
                    marginTop: 8,
                    textTransform: 'uppercase',
                    position: 'relative',
                    zIndex: 1,
                }, children: "P\u00C3O FRESCO NA PORTA" }), _jsx("div", { className: "flex-1" }), _jsxs("div", { style: {
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    padding: 20,
                    boxShadow: 'var(--shadow-soft)',
                    marginBottom: 32,
                    position: 'relative',
                    zIndex: 1,
                }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontWeight: 700,
                            fontSize: 15,
                            color: '#241608',
                            marginBottom: 12,
                            margin: '0 0 12px 0',
                        }, children: "Instalar o Cheirin" }), _jsx(PrimaryButton, { onClick: handleCTA, children: "Instalar e criar conta" }), _jsx("button", { onClick: () => { }, style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            minHeight: 44,
                            background: 'transparent',
                            color: '#B0702A',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: 4,
                        }, children: "J\u00E1 tenho conta \u2014 entrar" })] }), showIOSSheet && (_jsx(IOSInstallSheet, { onDismiss: () => setShowIOSSheet(false) }))] }));
}
function PrimaryButton({ onClick, children }) {
    const [hovered, setHovered] = useState(false);
    return (_jsx("button", { onClick: onClick, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 44,
            backgroundColor: '#E3AC3F',
            color: '#1E1207',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            padding: '13px 18px',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform .15s, filter .15s',
            transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
            filter: hovered ? 'brightness(1.05)' : 'none',
        }, children: children }));
}
function IOSInstallSheet({ onDismiss }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { onClick: onDismiss, style: {
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    zIndex: 40,
                } }), _jsxs("div", { style: {
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#FFFFFF',
                    borderRadius: '22px 22px 0 0',
                    padding: 24,
                    zIndex: 50,
                    transform: 'translateY(0)',
                    transition: 'transform 300ms ease-out',
                }, children: [_jsx("h2", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 21,
                            letterSpacing: '-0.02em',
                            color: '#241608',
                            marginBottom: 20,
                        }, children: "Adicionar \u00E0 tela inicial" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    minHeight: 44,
                                }, children: [_jsx(Icon, { name: "arrowU", size: 24, color: "#241608" }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 15,
                                            color: '#241608',
                                        }, children: "Toque no bot\u00E3o de compartilhar" })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    minHeight: 44,
                                }, children: [_jsx(Icon, { name: "list", size: 24, color: "#241608" }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 15,
                                            color: '#241608',
                                        }, children: "Role para baixo e toque em" })] }), _jsx("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    minHeight: 44,
                                    paddingLeft: 36,
                                }, children: _jsx("span", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 15,
                                        color: '#241608',
                                        fontWeight: 700,
                                    }, children: "\u2018Adicionar \u00E0 Tela Inicial\u2019" }) })] }), _jsx("button", { onClick: onDismiss, style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            minHeight: 44,
                            marginTop: 16,
                            background: 'transparent',
                            color: '#B0702A',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                        }, children: "Entendi" })] })] }));
}
