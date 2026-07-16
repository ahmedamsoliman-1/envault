"use client";

import { Toaster } from "sonner";

export function Notifications() {
  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}
