import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { RootGate } from './RootGate'
import { RequireAuth, RequireAdmin, RedirectIfAuth } from './guards'
import { AppLayout } from '@app/layouts/AppLayout'
import { AuthLayout } from '@app/layouts/AuthLayout'
import { InstallWizard } from '@features/install/InstallWizard'
import { DriveExplorerPage } from '@features/drive-explorer/DriveExplorerPage'
import { RecentPage } from '@features/recent/RecentPage'
import { StarredPage } from '@features/starred/StarredPage'
import { TrashPage } from '@features/trash/TrashPage'
import { SearchPage } from '@features/search/SearchPage'
import { ProfilePage } from '@features/profile/ProfilePage'
import { NotificationsPage } from '@features/notifications/pages/NotificationsPage'
import { AssetsPage } from '@features/assets/AssetsPage'
import { LoginPage } from '@features/auth/LoginPage'
import { ForgotPasswordPage } from '@features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@features/auth/ResetPasswordPage'
import { PublicLinkPage } from '@features/public-link/PublicLinkPage'
import { MyLinksPage } from '@features/share-links/pages/MyLinksPage'

/*
  Administración y Almacenamiento se cargan al entrar (code-splitting): llevan
  las gráficas (ApexCharts, ~800 KB) y la mayoría de usuarios nunca las abre.
*/
const RELOAD_KEY = 'pc-chunk-reload'

/**
 * Tras una actualización, una pestaña abierta con la versión anterior pide
 * archivos que ya no existen: se recarga una vez para traer los nuevos.
 */
function withReload<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().then(
      (mod) => {
        try {
          sessionStorage.removeItem(RELOAD_KEY)
        } catch {
          /* sin almacenamiento */
        }
        return mod
      },
      (err) => {
        try {
          if (!sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, '1')
            window.location.reload()
            return new Promise<T>(() => {}) // la recarga reemplaza la página
          }
        } catch {
          /* sin almacenamiento: se muestra el error */
        }
        throw err
      }
    )
}

const lazyAdmin = withReload(() => import('@features/admin/AdminPage').then((m) => ({ Component: m.AdminPage })))
const lazyStorage = withReload(() => import('@features/storage-quota/StoragePage').then((m) => ({ Component: m.StoragePage })))
const lazySettings = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  withReload(() => load().then((m) => ({ Component: m[name] })))

/**
 * Rutas de la aplicación.
 * RootGate → (instalador | login | app con guards de sesión/admin).
 */
const router = createBrowserRouter([
  {
    element: <RootGate />,
    children: [
      // Instalador (sin sesión, pantalla propia).
      { path: '/install', element: <InstallWizard /> },

      // Rutas públicas de autenticación bajo el mismo AuthLayout
      {
        element: <AuthLayout />,
        children: [
          {
            // Con sesión iniciada no se puede volver a estas pantallas: si el
            // usuario pasó por «¿Olvidaste tu contraseña?» antes de entrar,
            // esa entrada sigue en el historial y «atrás» lo devolvía ahí.
            element: <RedirectIfAuth />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
          // Fuera del guard a propósito: se abre desde el enlace del correo con
          // un token de un solo uso, y debe funcionar aunque haya una sesión
          // abierta en el mismo navegador.
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },

      // Enlace compartido: sin sesión y de solo lectura (con o sin sesión abierta).
      { path: '/s/:token', element: <PublicLinkPage /> },

      // App autenticada.
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <AppLayout />,
            children: [
              { index: true, element: <DriveExplorerPage /> },
              { path: 'folder/:folderId', element: <DriveExplorerPage /> },
              { path: 'recent', element: <RecentPage /> },
              { path: 'starred', element: <StarredPage /> },
              { path: 'trash', element: <TrashPage /> },
              { path: 'search', element: <SearchPage /> },
              { path: 'quota', lazy: lazyStorage },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: 'links', element: <MyLinksPage /> },
              { path: 'assets/*', element: <AssetsPage /> },
              // Solo administradores. Dashboard, Usuarios y Auditoría comparten UNA
              // ruta padre: AdminPage queda montada al cambiar de sección (antes se
              // desmontaba y volvía a montar, y el encabezado parpadeaba).
              {
                element: <RequireAdmin />,
                children: [
                  {
                    path: 'admin',
                    lazy: lazyAdmin,
                    children: [
                      { index: true, element: null },
                      { path: 'users', element: null },
                      { path: 'activity', element: null },
                      { path: 'links', element: null },
                    ],
                  },
                  // Configuración con pestañas verticales (layout propio + subrutas).
                  {
                    path: 'admin/settings',
                    lazy: lazySettings(() => import('@features/admin/settings/SettingsLayout'), 'SettingsLayout'),
                    children: [
                      { index: true, lazy: lazySettings(() => import('@features/admin/settings/pages/GeneralSettings'), 'GeneralSettings') },
                      { path: 'appearance', lazy: lazySettings(() => import('@features/admin/settings/pages/AppearanceSettings'), 'AppearanceSettings') },
                      { path: 'integrations', lazy: lazySettings(() => import('@features/admin/settings/pages/IntegrationsSettings'), 'IntegrationsSettings') },
                      { path: 'cron', lazy: lazySettings(() => import('@features/admin/settings/pages/CronSettings'), 'CronSettings') },
                      { path: 'updates', lazy: lazySettings(() => import('@features/admin/settings/pages/UpdatesSettings'), 'UpdatesSettings') },
                      { path: 'email', lazy: lazySettings(() => import('@features/admin/settings/pages/EmailSettings'), 'EmailSettings') },
                      { path: 'email-templates', lazy: lazySettings(() => import('@features/admin/settings/pages/EmailTemplatesSettings'), 'EmailTemplatesSettings') },
                      { path: 'email-templates/:key', lazy: lazySettings(() => import('@features/admin/settings/pages/EmailTemplateEditor'), 'EmailTemplateEditor') },
                      { path: 'workspace', lazy: lazySettings(() => import('@features/admin/settings/pages/WorkspaceSettings'), 'WorkspaceSettings') },
                      { path: 'database', lazy: lazySettings(() => import('@features/admin/settings/pages/DatabaseSettings'), 'DatabaseSettings') },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
