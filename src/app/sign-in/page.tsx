"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: "vogaranova.com", prompt: "select_account" });
      const credential = await signInWithPopup(getFirebaseAuth(), provider);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Authentication failed.");
      }
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
      setPending(false);
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card">
        <div className="brand-mark">VN</div>
        <span className="eyebrow">VOGARA PROMPT OS</span>
        <h1>Governed intelligence, for the right people.</h1>
        <p>Sign in with your Vogara Nova Google Workspace account.</p>
        <button className="button" onClick={signIn} disabled={pending}>
          {pending ? "Signing in…" : "Continue with Google"}
        </button>
        {error ? <p className="auth-error">{error}</p> : null}
      </section>
    </main>
  );
}
