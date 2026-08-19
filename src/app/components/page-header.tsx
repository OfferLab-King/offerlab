import type { ReactNode } from "react";

type PageHeaderProps = Readonly<{
  eyebrow: string;
  title: string;
  intro?: string;
  actions?: ReactNode;
  compact?: boolean;
}>;

export function PageHeader({ eyebrow, title, intro, actions, compact }: PageHeaderProps) {
  return (
    <section className={compact ? "workspace-hero compact-hero" : "workspace-hero"}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {intro ? <p className="intro">{intro}</p> : null}
      </div>
      {actions ? <div className="workspace-hero-actions">{actions}</div> : null}
    </section>
  );
}
