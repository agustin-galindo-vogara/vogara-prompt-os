"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenText, Boxes, ClipboardCheck, Component, Gauge, GitBranch, LogOut, Search } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

const nav = [
  { label: "Dashboard", href: "/", icon: Gauge },
  { label: "Library", href: "/library", icon: BookOpenText },
  { label: "Workflows", href: "/workflows", icon: GitBranch },
  { label: "Review Queue", href: "/reviews", icon: ClipboardCheck },
  { label: "Standards", href: "/standards", icon: Boxes },
  { label: "Components", href: "/components", icon: Component },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  if (pathname === "/sign-in") return children;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/sign-in");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-logo-card"><img src="/brand/vogara-nova.png" alt="Vogara Nova" /></div>
          <div className="brand-product"><strong>Prompt OS</strong><span>Governed intelligence</span></div>
        </div>
        <nav>
          {nav.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return <Link className={active ? "active" : undefined} key={href} href={href}><Icon size={17} strokeWidth={1.8}/><span>{label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-footer"><span>Workspace</span><strong>Vogara Nova</strong><small>Multi-brand foundation · v1</small></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">Prompt OS</div>
          <form className="search topbar-search" action="/library" method="get">
            <Search size={16}/>
            <input ref={searchRef} aria-label="Search Prompt OS" name="q" placeholder="Search Prompt OS" />
            <kbd>⌘ K</kbd>
          </form>
          <button className="sign-out" aria-label="Sign out" onClick={signOut}><span>AG</span><LogOut size={15}/></button>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
