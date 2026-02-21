import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { RequirePerm } from "./auth/RequirePerm";
import { RequireAnyPerm } from "./auth/RequireAnyPerm";

import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Sites from "./pages/Sites";
import Contacts from "./pages/Contacts";
import Inventory from "./pages/Inventory";
import Audit from "./pages/Audit";
import Maintenance from "./pages/Maintenance";
import MaintenanceWip from "./pages/MaintenanceWip";
import Wiki from "./pages/Wiki";
import Search from "./pages/Search";
import Trash from "./pages/Trash";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

import { RequireAuth } from "./auth/RequireAuth";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },

      {
        path: "customers",
        element: (
          <RequirePerm perm="crm.view_customer">
            <Customers />
          </RequirePerm>
        ),
      },
      {
        path: "sites",
        element: (
          <RequirePerm perm="crm.view_site">
            <Sites />
          </RequirePerm>
        ),
      },
      {
        path: "contacts",
        element: (
          <RequirePerm perm="crm.view_contact">
            <Contacts />
          </RequirePerm>
        ),
      },
      {
        path: "inventory",
        element: (
          <RequirePerm perm="inventory.view_inventory">
            <Inventory />
          </RequirePerm>
        ),
      },

      {
        path: "audit",
        element: (
          <RequirePerm perm="audit.view_auditevent">
            <Audit />
          </RequirePerm>
        ),
      },

      {
        path: "trash",
        element: (
          <RequireAnyPerm
            perms={[
              "crm.view_customer",
              "crm.view_site",
              "crm.view_contact",
              "inventory.view_inventory",
            ]}
          >
            <Trash />
          </RequireAnyPerm>
        ),
      },

      {
        path: "maintenance",
        element: (
          <RequireAnyPerm
            perms={[
              "maintenance.view_maintenanceplan",
              "maintenance.view_maintenanceevent",
              "maintenance.view_tech",
            ]}
          >
            <Maintenance />
          </RequireAnyPerm>
        ),
      },

      {
        path: "maintenance_wip",
        element: (
          <RequireAnyPerm
            perms={[
              "maintenance.view_maintenanceplan",
              "maintenance.view_maintenanceevent",
              "maintenance.view_tech",
            ]}
          >
            <MaintenanceWip />
          </RequireAnyPerm>
        ),
      },

      {
        path: "dashboard_wip",
        element: <Dashboard />,
      },

      {
        path: "wiki",
        element: (
          <RequirePerm perm="wiki.view_wikipage">
            <Wiki />
          </RequirePerm>
        ),
      },

      { path: "search", element: <Search /> },
      { path: "profile", element: <Profile /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
