"use client";

import { useEffect, useId, useRef, useState } from "react";

type EmployerOption = Readonly<{
  id: string;
  slug: string;
  name: string;
  industryKey: string | null;
}>;

const MIN_QUERY_LENGTH = 2;

export function EmployerCompanyField({
  defaultCompanyId,
  defaultValue,
  describedBy,
  invalid,
}: Readonly<{
  defaultCompanyId: string | null;
  defaultValue: string;
  describedBy?: string | undefined;
  invalid: boolean;
}>) {
  const [value, setValue] = useState(defaultValue);
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [options, setOptions] = useState<readonly EmployerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsId = useId();

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  async function search(query: string): Promise<void> {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setOptions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    try {
      const response = await fetch(`/api/employers/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { results: EmployerOption[] };
      setOptions(payload.results);
      setOpen(payload.results.length > 0);
      setActiveIndex(payload.results.length > 0 ? 0 : -1);
    } catch {
      // aborted or network failure; keep current state
    } finally {
      setPending(false);
    }
  }

  function select(option: EmployerOption): void {
    setValue(option.name);
    setCompanyId(option.id);
    setOpen(false);
    setActiveIndex(-1);
  }

  function moveActive(direction: 1 | -1): void {
    if (!open || options.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + direction + options.length) % options.length;
      return next;
    });
  }

  return (
    <div className="employer-company-field">
      <input
        aria-activedescendant={activeIndex >= 0 ? `${optionsId}-${activeIndex}` : undefined}
        aria-controls={optionsId}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-invalid={invalid}
        aria-autocomplete="list"
        autoComplete="off"
        id="company"
        maxLength={120}
        name="company"
        onChange={(event) => {
          const next = event.currentTarget.value;
          setValue(next);
          setCompanyId("");
          setActiveIndex(-1);
          void search(next);
        }}
        onFocus={() => {
          if (options.length > 0) setOpen(true);
        }}
        onBlur={() => {
          blurTimerRef.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) setOpen(options.length > 0);
            else moveActive(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            moveActive(-1);
          } else if (event.key === "Enter") {
            if (open && activeIndex >= 0 && options[activeIndex]) {
              event.preventDefault();
              select(options[activeIndex]!);
            }
          } else if (event.key === "Escape") {
            if (open) {
              event.preventDefault();
              setOpen(false);
            }
          }
        }}
        placeholder="Type an employer name"
        required
        role="combobox"
        value={value}
      />
      <input name="companyId" type="hidden" value={companyId} />
      {open && (
        <ul className="employer-company-options" id={optionsId} role="listbox">
          {options.map((option, index) => (
            <li key={option.slug}>
              <button
                aria-selected={index === activeIndex}
                id={`${optionsId}-${index}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
                onClick={() => select(option)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                {option.name}
                {option.industryKey ? (
                  <span className="employer-company-option-industry">
                    {" "}
                    · {option.industryKey.replaceAll("_", " ")}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending && <span className="hint">Searching employers…</span>}
    </div>
  );
}
