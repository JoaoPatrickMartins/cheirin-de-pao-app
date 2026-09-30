import { createBrowserRouter } from 'react-router'
import { SplashScreen } from '../pages/splash/SplashScreen'
import { AuthProvider } from '../contexts/AuthContext'
import { RedirectIfAuthenticated } from '../components/RedirectIfAuthenticated'

// Função, não constante: o createBrowserRouter lê a URL NA HORA em que é criado. O main.tsx
// reescreve `/?social=<id>` → `/entrar/social` (retorno do Google) ANTES de criar o router — com uma
// constante criada no import, o router já nascia em `/` e mostrava a splash com a URL nova na barra.
export const createAppRouter = () => createBrowserRouter([
  {
    Component: AuthProvider,
    children: [
      // Rotas públicas: usuário já autenticado é enviado direto para a home do
      // seu perfil, em vez de rever a splash/login/cadastro (a sessão persiste
      // no localStorage e é reidratada ao reabrir o PWA/navegador).
      {
        Component: RedirectIfAuthenticated,
        children: [
          {
            path: '/',
            element: <SplashScreen />,
          },
          {
            path: '/login',
            lazy: () =>
              import('../pages/auth/LoginScreen').then((m) => ({
                Component: m.LoginScreen,
              })),
          },
          {
            path: '/register',
            lazy: () =>
              import('../pages/auth/OnboardingScreen').then((m) => ({
                Component: m.OnboardingScreen,
              })),
          },
        ],
      },
      // Login com Google — retorno (L3a/L3b/L3c/L6). Fora da guarda de logado: o "conectar pelo
      // Perfil" também volta por aqui, com a pessoa já logada.
      {
        path: '/entrar/social',
        lazy: () =>
          import('../pages/auth/SocialReturnScreen').then((m) => ({
            Component: m.SocialReturnScreen,
          })),
      },
      // Páginas públicas (L9) — abrem logado ou não; o Google e a LGPD pedem URL pública.
      {
        path: '/privacidade',
        lazy: () => import('../pages/legal/LegalPage').then((m) => ({ Component: m.PrivacyPage })),
      },
      {
        path: '/termos',
        lazy: () => import('../pages/legal/LegalPage').then((m) => ({ Component: m.TermsPage })),
      },
      {
        path: '/exclusao-de-dados',
        lazy: () => import('../pages/legal/LegalPage').then((m) => ({ Component: m.DataDeletionPage })),
      },
      {
        path: '/create-password',
        lazy: () =>
          import('../pages/auth/CreatePasswordScreen').then((m) => ({
            Component: m.CreatePasswordScreen,
          })),
      },
      {
        path: '/set-password',
        lazy: () =>
          import('../pages/auth/SetPasswordScreen').then((m) => ({
            Component: m.SetPasswordScreen,
          })),
      },
      {
        path: '/forgot-password',
        lazy: () =>
          import('../pages/auth/ForgotPasswordScreen').then((m) => ({
            Component: m.ForgotPasswordScreen,
          })),
      },
      {
        path: '/change-password',
        lazy: () =>
          import('../pages/auth/ChangePasswordScreen').then((m) => ({
            Component: m.ChangePasswordScreen,
          })),
      },
      {
        path: '/client',
        lazy: () =>
          import('../pages/client/ClientLayout').then((m) => ({
            Component: m.ClientLayout,
          })),
        children: [
          {
            index: true,
            lazy: () =>
              import('../pages/client/HomeScreen').then((m) => ({
                Component: m.HomeScreen,
              })),
          },
          {
            path: 'home',
            lazy: () =>
              import('../pages/client/HomeScreen').then((m) => ({
                Component: m.HomeScreen,
              })),
          },
          {
            path: 'creditos',
            lazy: () =>
              import('../pages/client/CombosScreen').then((m) => ({
                Component: m.CombosScreen,
              })),
          },
          {
            path: 'agenda',
            lazy: () =>
              import('../pages/client/ScheduleScreen').then((m) => ({
                Component: m.ScheduleScreen,
              })),
          },
          {
            path: 'agenda/pedido-unico',
            lazy: () =>
              import('../pages/client/SingleScreen').then((m) => ({
                Component: m.SingleScreen,
              })),
          },
          {
            path: 'pedidos',
            lazy: () =>
              import('../pages/client/TrackingScreen').then((m) => ({
                Component: m.TrackingScreen,
              })),
          },
          {
            path: 'market',
            lazy: () =>
              import('../pages/client/MarketCatalog').then((m) => ({
                Component: m.MarketCatalog,
              })),
          },
          {
            path: 'market/produto/:id',
            lazy: () =>
              import('../pages/client/ProductDetail').then((m) => ({
                Component: m.ProductDetail,
              })),
          },
          {
            path: 'market/cestinha',
            lazy: () =>
              import('../pages/client/CestinhaScreen').then((m) => ({
                Component: m.CestinhaScreen,
              })),
          },
          {
            path: 'market/checkout',
            lazy: () =>
              import('../pages/client/MarketCheckoutScreen').then((m) => ({
                Component: m.MarketCheckoutScreen,
              })),
          },
          {
            path: 'market/sucesso',
            lazy: () =>
              import('../pages/client/MarketDoneScreen').then((m) => ({
                Component: m.MarketDoneScreen,
              })),
          },
          {
            path: 'notificacoes',
            lazy: () =>
              import('../pages/client/NotificationsScreen').then((m) => ({
                Component: m.NotificationsScreen,
              })),
          },
          {
            path: 'perfil',
            lazy: () =>
              import('../pages/client/SettingsScreen').then((m) => ({
                Component: m.SettingsScreen,
              })),
          },
          {
            path: 'perfil/conta',
            lazy: () =>
              import('../pages/client/AccountScreen').then((m) => ({
                Component: m.AccountScreen,
              })),
          },
          {
            path: 'perfil/cartoes',
            lazy: () =>
              import('../pages/client/CardsScreen').then((m) => ({
                Component: m.CardsScreen,
              })),
          },
          {
            path: 'perfil/editar-contato',
            lazy: () =>
              import('../pages/client/ContactEditScreen').then((m) => ({
                Component: m.ContactEditScreen,
              })),
          },
          {
            path: 'perfil/gancho',
            lazy: () =>
              import('../pages/client/HookScreen').then((m) => ({
                Component: m.HookScreen,
              })),
          },
          {
            // Perfil › Ajuda › Privacidade e termos (hub das 3 páginas públicas).
            path: 'perfil/privacidade',
            lazy: () =>
              import('../pages/legal/LegalPage').then((m) => ({
                Component: m.LegalHubScreen,
              })),
          },
          {
            path: 'perfil/indique',
            lazy: () =>
              import('../pages/client/ReferralScreen').then((m) => ({
                Component: m.ReferralScreen,
              })),
          },
          {
            path: 'creditos/pix',
            lazy: () =>
              import('../pages/client/PixWaitingScreen').then((m) => ({
                Component: m.PixWaitingScreen,
              })),
          },
          {
            path: 'creditos/cartao',
            lazy: () =>
              import('../pages/client/CardPaymentScreen').then((m) => ({
                Component: m.CardPaymentScreen,
              })),
          },
          {
            path: 'creditos/sucesso',
            lazy: () =>
              import('../pages/client/PurchasedScreen').then((m) => ({
                Component: m.PurchasedScreen,
              })),
          },
          {
            path: 'creditos/extrato',
            lazy: () =>
              import('../pages/client/CreditHistoryScreen').then((m) => ({
                Component: m.CreditHistoryScreen,
              })),
          },
          {
            path: 'creditos/recorrente',
            lazy: () =>
              import('../pages/client/AutoBuyScreen').then((m) => ({
                Component: m.AutoBuyScreen,
              })),
          },
        ],
      },
      {
        path: '/courier',
        lazy: () =>
          import('../pages/courier/CourierLayout').then((m) => ({
            Component: m.CourierLayout,
          })),
        children: [
          {
            index: true,
            lazy: () =>
              import('../pages/courier/CourierScreen').then((m) => ({
                Component: m.CourierScreen,
              })),
          },
        ],
      },
      {
        path: '/admin',
        lazy: () =>
          import('../pages/admin/AdminLayout').then((m) => ({
            Component: m.AdminLayout,
          })),
        children: [
          {
            path: 'couriers/new',
            lazy: () =>
              import('../pages/admin/CourierRegisterScreen').then((m) => ({
                Component: m.CourierRegisterScreen,
              })),
          },
        ],
      },
    ],
  },
])
