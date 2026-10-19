import type {Metadata} from "next";import {AppShell} from "@/components/app-shell";import {getSessionUser} from "@/lib/auth/session";import "./globals.css";import "./auth.css";import "./governance.css";import "./brand.css";
export const metadata:Metadata={title:"Vogara Prompt OS",description:"Governed Intelligence & Prompt Operating System"};
export default async function RootLayout({children}:{children:React.ReactNode}){const user=await getSessionUser();return <html lang="en"><body><AppShell roles={user?.roles} userName={user?.name ?? user?.email}>{children}</AppShell></body></html>}
