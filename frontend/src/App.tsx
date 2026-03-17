import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { AppLayout } from './layout/AppLayout'
import { RequirePerm } from './auth/RequirePerm'
import { RequireAnyPerm } from './auth/RequireAnyPerm'

// Route-level code splitting (reduces the large Vite chunk warning)
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const SiteRepository = lazy(() => import('./pages/SiteRepository'))
const Customers = lazy(() => import('./pages/Customers'))
const Sites = lazy(() => import('./pages/Sites'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Audit = lazy(() => import('./pages/Audit'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const Wiki = lazy(() => import('./pages/Wiki'))
const WikiPage = lazy(() => import('./pages/WikiPage'))
const WikiStats = lazy(() => import('./pages/WikiStats'))
const Search = lazy(() => import('./pages/Search'))
const Trash = lazy(() => import('./pages/Trash'))
const Drive = lazy(() => import('./pages/Drive'))
const Profile = lazy(() => import('./pages/Profile'))
const Issues = lazy(() => import('./pages/Issues'))
const BugFeature = lazy(() => import('./pages/BugFeature'))
const NotFound = lazy(() => import('./pages/NotFound'))

import { RequireAuth } from './auth/RequireAuth'

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress />
    </Box>
  )
}

function lazyEl(el: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{el}</Suspense>
}

const router = createBrowserRouter([
  { path: '/login', element: lazyEl(<Login />) },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: lazyEl(<Dashboard />) },

      {
        path: 'site-repository',
        element: (
          <RequireAnyPerm
            perms={[
              'inventory.view_inventory',
              'crm.view_customer',
              'crm.view_site',
              'crm.view_contact',
            ]}
          >
            {lazyEl(<SiteRepository />)}
          </RequireAnyPerm>
        ),
      },

      {
        path: 'customers',
        element: <RequirePerm perm="crm.view_customer">{lazyEl(<Customers />)}</RequirePerm>,
      },
      {
        path: 'sites',
        element: <RequirePerm perm="crm.view_site">{lazyEl(<Sites />)}</RequirePerm>,
      },
      {
        path: 'contacts',
        element: <RequirePerm perm="crm.view_contact">{lazyEl(<Contacts />)}</RequirePerm>,
      },
      {
        path: 'inventory',
        element: <RequirePerm perm="inventory.view_inventory">{lazyEl(<Inventory />)}</RequirePerm>,
      },

      {
        path: 'audit',
        element: <RequirePerm perm="audit.view_auditevent">{lazyEl(<Audit />)}</RequirePerm>,
      },

      {
        path: 'trash',
        element: (
          <RequireAnyPerm
            perms={[
              'crm.view_customer',
              'crm.view_site',
              'crm.view_contact',
              'inventory.view_inventory',
              'maintenance.view_maintenanceplan',
              'maintenance.view_tech',
            ]}
          >
            {lazyEl(<Trash />)}
          </RequireAnyPerm>
        ),
      },

      {
        path: 'maintenance',
        element: (
          <RequireAnyPerm
            perms={[
              'maintenance.view_maintenanceplan',
              'maintenance.view_maintenanceevent',
              'maintenance.view_tech',
            ]}
          >
            {lazyEl(<Maintenance />)}
          </RequireAnyPerm>
        ),
      },

      {
        path: 'wiki',
        element: <RequirePerm perm="wiki.view_wikipage">{lazyEl(<Wiki />)}</RequirePerm>,
      },
      {
        path: 'wiki/stats',
        element: <RequirePerm perm="wiki.view_wikipage">{lazyEl(<WikiStats />)}</RequirePerm>,
      },
      {
        path: 'wiki/:id',
        element: <RequirePerm perm="wiki.view_wikipage">{lazyEl(<WikiPage />)}</RequirePerm>,
      },

      {
        path: 'drive',
        element: (
          <RequireAnyPerm perms={['drive.view_drivefolder', 'drive.view_drivefile']}>
            {lazyEl(<Drive />)}
          </RequireAnyPerm>
        ),
      },

      { path: 'search', element: lazyEl(<Search />) },
      { path: 'profile', element: lazyEl(<Profile />) },
      {
        path: 'issues',
        element: <RequirePerm perm="issues.view_issue">{lazyEl(<Issues />)}</RequirePerm>,
      },
      { path: 'bug-feature', element: lazyEl(<BugFeature />) },
      { path: 'bug-feature/resolved', element: lazyEl(<BugFeature />) },
      { path: '*', element: lazyEl(<NotFound />) },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
