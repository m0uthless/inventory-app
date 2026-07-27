import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { AppLayout } from './layout/AppLayout'
import { RequireAuth } from './auth/RequireAuth'
import { RequireAuslBoPerm } from './auth/RequireAuslBoPerm'

const Login     = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Device    = lazy(() => import('./pages/Device'))
const Sites     = lazy(() => import('./pages/Sites'))
const Contacts  = lazy(() => import('./pages/Contacts'))
const Scadenze  = lazy(() => import('./pages/Scadenze'))
const Report    = lazy(() => import('./pages/Report'))
const NotFound  = lazy(() => import('./pages/NotFound'))
const Forbidden = lazy(() => import('./pages/Forbidden'))
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
      {
        path: 'inventory',
        element: <RequireAuslBoPerm perm="inventory.view_inventory">{lazy$(<Inventory />)}</RequireAuslBoPerm>,
      },
      {
        path: 'device',
        element: <RequireAuslBoPerm perm="device.view_device">{lazy$(<Device />)}</RequireAuslBoPerm>,
      },
      {
        path: 'sites',
        element: <RequireAuslBoPerm perm="crm.view_site">{lazy$(<Sites />)}</RequireAuslBoPerm>,
      },
      {
        path: 'contacts',
        element: <RequireAuslBoPerm perm="crm.view_contact">{lazy$(<Contacts />)}</RequireAuslBoPerm>,
      },
      // Scadenze e Report sono ancora pagine stub (nessuna chiamata API reale,
      // nessun dato sensibile esposto): restano dietro solo RequireAuth finché
      // non verrà definito cosa mostrano e con quale permesso Django.
      { path: 'scadenze',     element: lazy$(<Scadenze />) },
      { path: 'report',       element: lazy$(<Report />) },
      {
        path: 'vlan',
        element: <RequireAuslBoPerm perm="vlan.view_vlan">{lazy$(<Vlan />)}</RequireAuslBoPerm>,
      },
      {
        path: 'richieste',
        element: <RequireAuslBoPerm perm="vlan.view_vlaniprequest">{lazy$(<Richieste />)}</RequireAuslBoPerm>,
      },
      { path: '403',          element: lazy$(<Forbidden />) },
      { path: '*',            element: lazy$(<NotFound />) },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
