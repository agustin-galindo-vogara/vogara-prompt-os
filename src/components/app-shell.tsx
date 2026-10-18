"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  ["Dashboard", "/"],
  ["Library", "/library"],
  ["Workflows", "/workflows"],
  ["Review Queue", "/reviews"],
  ["Standards", "/standards"],
  ["Components", "/components"],
  ["Analytics", "/analytics"],
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/sign-in") return children;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/sign-in");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">VN</div>
          <div><strong>Vogara Prompt OS</strong><span>Governed Intelligence</span></div>
        </div>
        <nav>
          {nav.map(([label, href]) => (
            <Link className={pathname === href ? "active" : undefined} key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <div className="sidebar-footer"><span>Workspace</span><strong>Vogara Nova</strong></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="search">⌘K&nbsp;&nbsp; Search Prompt OS</div>
          <button className="avatar" aria-label="Sign out" onClick={signOut}>AG</button>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
