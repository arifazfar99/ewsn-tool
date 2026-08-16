import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/auth";
import SuccessToast from "@/components/SuccessToast";

// Every page here is auth-gated and reads live DB state - never statically
// prerender any of them at build time (also avoids build-time DB connections).
export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/items", label: "Items" },
  { href: "/quotations", label: "Quotations" },
  { href: "/delivery-orders", label: "Delivery Orders" },
  { href: "/invoices", label: "Invoices" },
  { href: "/profile", label: "Profile" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <nav className="flex items-center justify-between gap-6 border-b border-paper-line bg-panel px-6 py-3">
        <div className="flex items-center gap-6">
          <span
            className="text-lg font-semibold tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            EWSN
          </span>
          <div className="hidden items-center gap-5 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="link-ink">
            Log out
          </button>
        </form>
      </nav>
      <div className="flex gap-5 border-b border-paper-line bg-panel px-6 py-2 sm:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs font-medium text-ink-soft hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <main className="flex-1 px-6 py-8">{children}</main>
      <Suspense fallback={null}>
        <SuccessToast />
      </Suspense>
    </div>
  );
}
