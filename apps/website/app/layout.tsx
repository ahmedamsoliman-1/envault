import type { Metadata } from "next";
import type { ReactNode } from "react";

import { VaultLifecycle } from "@/components/vault/vault-lifecycle";
import { Notifications } from "@/components/providers/notifications";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Envault",
    template: "%s · Envault",
  },
  description: "Your environments, organized and protected.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <VaultLifecycle />
        <Notifications />
      </body>
    </html>
  );
}
