import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@app/layouts/AppLayout'
import { AuthLayout } from '@app/layouts/AuthLayout'
import { DriveExplorerPage } from '@features/drive-explorer/DriveExplorerPage'
import { RecentPage } from '@features/recent/RecentPage'
import { StarredPage } from '@features/starred/StarredPage'
import { TrashPage } from '@features/trash/TrashPage'
import { SearchPage } from '@features/search/SearchPage'
import { AdminPage } from '@features/admin/AdminPage'
import { LoginPage } from '@features/auth/LoginPage'

/**
 * Rutas de la aplicación.
 * Los guards de autenticación (RequireAuth / RequireAdmin) se añaden en la Fase 3.
 */
const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
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
      { path: 'admin', element: <AdminPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
