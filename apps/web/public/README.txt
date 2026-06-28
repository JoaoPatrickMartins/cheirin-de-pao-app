pwa-192x192.png, pwa-512x512.png e apple-touch-icon.png foram gerados a partir da
marca BreadMark (arco dourado #E3AC3F sobre fundo #160C04), nas dimensões corretas
192x192, 512x512 e 180x180. Isso torna o PWA instalável (dispara o beforeinstallprompt).

Os 1x1 placeholders anteriores NÃO satisfaziam o requisito do Chrome (>=192 e >=512),
por isso o prompt de instalação nunca disparava.

Para produção, substitua por ícones oficiais do handoff de design, caso existam,
mantendo as mesmas dimensões.
