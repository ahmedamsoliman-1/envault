"use client";

import { EnvaultClient } from "@envault/api-client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

import { getClientAuth } from "@/lib/firebase-client";

const apiClient = new EnvaultClient({ baseUrl: "" });

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="rounded-lg border px-3 py-2 text-sm"
      onClick={() => {
        void (async () => {
          await apiClient.auth.session.delete();
          await signOut(getClientAuth());
          router.push("/login");
          router.refresh();
        })();
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
