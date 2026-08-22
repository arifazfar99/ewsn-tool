"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Truck,
  Receipt,
  UserCog,
  Menu,
  X,
} from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/items", label: "Items", icon: Package },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/delivery-orders", label: "Delivery Orders", icon: Truck },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/profile", label: "Profile", icon: UserCog },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function NavLinks({
  pathname,
  onNavigate,
  itemClassName,
}: {
  pathname: string;
  onNavigate?: () => void;
  itemClassName: string;
}) {
  return (
    <>
      {navLinks.map((link) => {
        const Icon = link.icon;
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`${itemClassName} ${
              active
                ? "bg-primary-soft text-primary"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Icon size={16} />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export default function SiteNav({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close the mobile drawer whenever the route changes - adjusted during
  // render (React's documented pattern for this, not a useEffect) since this
  // repo's lint rules reject synchronous setState-in-effect-body. No focus
  // restore here - navigation is already moving the user's attention to the
  // new page, unlike the explicit-dismissal paths below.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  // Move focus into the drawer when it opens (basic dialog behavior).
  useEffect(() => {
    if (menuOpen) {
      closeButtonRef.current?.focus();
    }
  }, [menuOpen]);

  // Explicit dismissal (Escape, backdrop, X, a nav link) returns focus to
  // the toggle button, since none of those already leave it focused.
  // Deferred one frame: clicking a non-focusable element (the backdrop div)
  // triggers the browser's own default blur-to-body behavior, which would
  // otherwise race a same-tick focus() call and win.
  function closeMenu() {
    setMenuOpen(false);
    requestAnimationFrame(() => toggleButtonRef.current?.focus());
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 flex-col border-r border-border bg-surface lg:flex lg:w-60">
        <div className="border-b border-border px-5 py-4">
          <span className="text-lg font-semibold tracking-tight text-ink">
            EWSN
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <NavLinks
            pathname={pathname}
            itemClassName="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          />
        </nav>
        <div className="border-t border-border px-3 py-4">
          <form action={signOutAction}>
            <button type="submit" className="link">
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="text-lg font-semibold tracking-tight text-ink">
          EWSN
        </span>
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="text-ink-soft hover:text-ink"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={closeMenu}
            className="fixed inset-0 z-40 bg-ink/10 lg:hidden"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface shadow-md lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-lg font-semibold tracking-tight text-ink">
                EWSN
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="text-ink-soft hover:text-ink"
              >
                <X size={22} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
              <NavLinks
                pathname={pathname}
                onNavigate={closeMenu}
                itemClassName="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
              />
            </nav>
            <div className="border-t border-border px-3 py-4">
              <form action={signOutAction}>
                <button type="submit" className="link">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
