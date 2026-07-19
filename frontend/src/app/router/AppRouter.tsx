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
import { StoragePage } from '@features/storage-quota/StoragePage'
import { ProfilePage } from '@features/profile/ProfilePage'
import { AssetsPage } from '@features/assets/AssetsPage'
import { LoginPage } from '@features/auth/LoginPage'

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
              { path: 'storage', element: <StoragePage /> },
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
                  { path: 'admin/settings', element: <AdminPage /> },
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
