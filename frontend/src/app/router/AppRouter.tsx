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
import { AdminPage } from '@features/admin/AdminPage'
import { SettingsLayout } from '@features/admin/settings/SettingsLayout'
import { GeneralSettings } from '@features/admin/settings/pages/GeneralSettings'
import { AppearanceSettings } from '@features/admin/settings/pages/AppearanceSettings'
import { EmailSettings } from '@features/admin/settings/pages/EmailSettings'
import { EmailTemplatesSettings } from '@features/admin/settings/pages/EmailTemplatesSettings'
import { AccessSettings } from '@features/admin/settings/pages/AccessSettings'
import { StoragePage } from '@features/storage-quota/StoragePage'
import { ProfilePage } from '@features/profile/ProfilePage'
import { AssetsPage } from '@features/assets/AssetsPage'
import { LoginPage } from '@features/auth/LoginPage'
import { ForgotPasswordPage } from '@features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@features/auth/ResetPasswordPage'

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

      // Login: si ya hay sesión, redirige a la app.
      {
        element: <RedirectIfAuth />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: '/login', element: <LoginPage /> }],
          },
        ],
      },

      // Restablecimiento de contraseña: público y accesible siempre (el enlace
      // llega por correo), sin RedirectIfAuth.
      {
        element: <AuthLayout />,
        children: [
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },

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
              { path: 'quota', element: <StoragePage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'assets', element: <AssetsPage /> },
              // Solo administradores. Cada sección de administración es su
              // propia ruta (accesible desde el sidebar), todas sobre AdminPage.
              {
                element: <RequireAdmin />,
                children: [
                  { path: 'admin', element: <AdminPage /> },
                  { path: 'admin/users', element: <AdminPage /> },
                  { path: 'admin/activity', element: <AdminPage /> },
                  // Configuración con pestañas verticales (layout propio + subrutas).
                  {
                    path: 'admin/settings',
                    element: <SettingsLayout />,
                    children: [
                      { index: true, element: <GeneralSettings /> },
                      { path: 'appearance', element: <AppearanceSettings /> },
                      { path: 'email', element: <EmailSettings /> },
                      { path: 'email-templates', element: <EmailTemplatesSettings /> },
                      { path: 'access', element: <AccessSettings /> },
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
