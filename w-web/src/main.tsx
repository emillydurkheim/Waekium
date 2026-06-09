import React from "react";

import ReactDOM from "react-dom/client";

import { RouterProvider } from "@tanstack/react-router";

import { router } from "./router";

import "./index.css";

import { AuthProvider } from "@/contexts/AuthContext";

ReactDOM.createRoot(
  document.getElementById("root")!
).render(

  <React.StrictMode>

    <AuthProvider>

      <RouterProvider router={router} />

    </AuthProvider>

  </React.StrictMode>
);