import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { AppLayout } from './layout/AppLayout'
import { RequireAuth } from './auth/RequireAuth'

const Login     = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Device    = lazy(() => import('./pages/Device'))
const Sites     = lazy(() => import('./pages/Sites'))
const Contacts  = lazy(() => import('./pages/Contacts'))
const Scadenze  = lazy(() => import('./pages/Scadenze'))
const Report    = lazy(() => import('./pages/Report'))
const NotFound  = lazy(() => import('./pages/NotFound'))
const Vlan      = lazy(() => import('./pages/Vlan'))
const Richieste = lazy(() => import('./pages/Richieste'))

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress />
    </Box>
  )
}

function lazy$(el: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{el}</Suspense>
}

const router = createBrowserRouter([
  { path: '/login', element: lazy$(<Login />) },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true,          element: lazy$(<Dashboard />) },
      { path: 'inventory',    element: lazy$(<Inventory />) },
      { path: 'device',       element: lazy$(<Device />) },
      { path: 'sites',        element: lazy$(<Sites />) },
      { path: 'contacts',     element: lazy$(<Contacts />) },
      { path: 'scadenze',     element: lazy$(<Scadenze />) },
      { path: 'report',       element: lazy$(<Report />) },
      { path: 'vlan',         element: lazy$(<Vlan />) },
      { path: 'richieste',    element: lazy$(<Richieste />) },
      { path: '*',            element: lazy$(<NotFound />) },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
