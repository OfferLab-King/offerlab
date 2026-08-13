"use client";

import { useEffect, useRef, useState } from "react";

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
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }

  return (
    <div className="employer-company-field">
      <input
        aria-controls="employer-company-options"
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-invalid={invalid}
        autoComplete="off"
        id="company"
        maxLength={120}
        name="company"
        onChange={(event) => {
          const next = event.currentTarget.value;
          setValue(next);
          setCompanyId("");
          void search(next);
        }}
        onFocus={() => {
          if (options.length > 0) setOpen(true);
        }}
        onBlur={() => {
          blurTimerRef.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Type an employer name"
        required
        role="combobox"
        value={value}
      />
      <input name="companyId" type="hidden" value={companyId} />
      {open && (
        <ul className="employer-company-options" id="employer-company-options" role="listbox">
          {options.map((option) => (
            <li key={option.slug}>
              <button
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option);
                }}
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
