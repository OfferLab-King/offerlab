"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { isDestinationCurrent, type SiteNavigationLink } from "./site-navigation";

type SiteNavProps = Readonly<{
  label: string;
  links: readonly SiteNavigationLink[];
}>;

export function SiteNav({ label, links }: SiteNavProps) {
  const pathname = usePathname();
  const linksId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);

  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    linksRef.current?.querySelector("a")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <nav aria-label={label} className={open ? "site-nav site-nav-open" : "site-nav"}>
      <button
        aria-controls={linksId}
        aria-expanded={open}
        className="site-nav-toggle"
        onClick={() => setOpen((current) => !current)}
        ref={toggleRef}
        type="button"
      >
        {open ? "Close" : "Menu"}
      </button>
      <ul className="site-nav-links" id={linksId} ref={linksRef}>
        {links.map((link) => {
          const current = isDestinationCurrent(pathname, link.href);
          return (
            <li key={link.href}>
              <Link aria-current={current ? "page" : undefined} href={link.href}>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <noscript>
        <style>{`
          .site-nav-toggle { display: none !important; }
          @media (max-width: 60rem) {
            .site-header { flex-wrap: wrap; }
            .site-nav { flex-basis: 100%; order: 3; width: 100%; }
            .site-nav-links { display: grid !important; }
            .site-header-actions { display: grid !important; }
            .site-header > form, .site-header > .status { display: block !important; }
          }
        `}</style>
      </noscript>
    </nav>
  );
}
