import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  children,
  description,
  title,
}: Readonly<{ children: ReactNode; description: string; title: string }>) {
  return (
    <main className="auth-shell">
      <section className="card">
        <Link className="brand" href="/">
          <span aria-hidden="true" className="brand__mark" />
          <span className="brand__word">OfferLab</span>
        </Link>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  );
}

export function StatusMessage({ children }: Readonly<{ children: string | undefined }>) {
  return children ? (
    <p aria-live="polite" className="status">
      {children}
    </p>
  ) : null;
}
