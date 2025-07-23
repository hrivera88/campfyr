import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { GuestRoute } from "./components/routes/GuestRoute";
import { ProtectedRoute } from "./components/routes/ProtectedRoute";
import { RedirectRoute } from "./components/routes/RedirectRoute";
import AppLayout from "./layouts/app-layout";
import Chat from "./pages/app/chat";
import Organization from "./pages/app/organization";
import UserProfile from "./pages/app/user";
import AcceptInvite from "./pages/auth/AcceptInvite";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ResetPassword from "./pages/auth/ResetPassword";

const router = createBrowserRouter([
  {
    path: "/",
    children: [
      {
        index: true,
        element: <RedirectRoute />
      },
      {
        path: "login",
        element: (
          <GuestRoute>
            <Login />
          </GuestRoute>
        ),
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "forgot-password",
        element: (
          <GuestRoute>
            <ForgotPassword />
          </GuestRoute>
        ),
      },
      {
        path: "reset-password/:token",
        element: (
          <GuestRoute>
            <ResetPassword />
          </GuestRoute>
        ),
      },
      {
        path: "invite/:token",
        element: <AcceptInvite />,
      },
      {
        element: <ProtectedRoute />,
        children: [ 
          {
            element: <AppLayout />,
            children: [
              {
                path: "chat",
                element: <Chat />,
              },
              {
                path: "profile",
                element: <UserProfile />
              },
              {
                path: "organization",
                element: <Organization />
              }
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
