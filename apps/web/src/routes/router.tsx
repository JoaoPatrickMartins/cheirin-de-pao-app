import { createBrowserRouter } from 'react-router'
import { SplashScreen } from '../pages/splash/SplashScreen'
import { AuthProvider } from '../contexts/AuthContext'

export const router = createBrowserRouter([
  {
    Component: AuthProvider,
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
              import('../pages/client/PlaceholderScreen').then((m) => ({
                Component: m.PlaceholderScreen,
              })),
          },
          {
            path: 'pedidos',
            lazy: () =>
              import('../pages/client/PlaceholderScreen').then((m) => ({
                Component: m.PlaceholderScreen,
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
