import { useState, useEffect } from 'react';
export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    useEffect(() => {
        // Detect standalone mode (already installed as PWA)
        const standalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(standalone);
        // Detect iOS Safari — exclude Chrome iOS (crios) and Firefox iOS (fxios)
        const ua = navigator.userAgent;
        const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
        setIsIOS(ios);
        // Android/Chrome: intercept native install prompt
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    const triggerInstall = async () => {
        if (!deferredPrompt)
            return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted')
            setIsInstallable(false);
        setDeferredPrompt(null);
    };
    return { isInstallable, isIOS, isStandalone, triggerInstall };
}
