import { Suspense } from "react";
import { signOut } from "@/lib/auth";
import SuccessToast from "@/components/SuccessToast";
import SiteNav from "@/components/SiteNav";

// Every page here is auth-gated and reads live DB state - never statically
// prerender any of them at build time (also avoids build-time DB connections).
export const dynamic = "force-dynamic";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <SiteNav signOutAction={handleSignOut} />
      <div className="flex min-h-full flex-1 flex-col">
        <main className="flex-1 px-6 py-8">{children}</main>
        <Suspense fallback={null}>
          <SuccessToast />
        </Suspense>
      </div>
    </div>
  );
}
