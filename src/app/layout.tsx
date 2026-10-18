import type {Metadata} from "next";import {AppShell} from "@/components/app-shell";import "./globals.css";
export const metadata:Metadata={title:"Vogara Prompt OS",description:"Governed Intelligence & Prompt Operating System"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AppShell>{children}</AppShell></body></html>}
