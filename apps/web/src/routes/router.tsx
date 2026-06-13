import { createBrowserRouter } from 'react-router'
import { SplashScreen } from '../pages/splash/SplashScreen'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SplashScreen />,
  },
  {
    path: '/client',
    lazy: () =>
      import('../pages/client/ClientLayout').then((m) => ({
        Component: m.ClientLayout,
      })),
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
  },
])
