"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";

type Confirmation = Readonly<{
  description?: string;
  label: string;
  prompt: string;
}>;

/**
 * Wraps a server-action form whose submit buttons carry a `name`/`value`
 * (typically `name="intent"`). When the submitted button matches one of the
 * `confirmations` keys, the first click reveals an inline confirmation and the
 * second click submits the original form with the original submitter button,
 * so the server action receives an unchanged FormData.
 */
export function ConfirmIntentForm({
  action,
  children,
  confirmations,
  formClassName,
}: Readonly<{
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmations: Readonly<Record<string, Confirmation>>;
  formClassName?: string;
}>) {
  const [pending, setPending] = useState<{
    button: HTMLButtonElement;
    confirmation: Confirmation;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    const key = submitter.name === "intent" ? submitter.value : submitter.name;
    const confirmation = confirmations[key];
    if (!confirmation) return;
    event.preventDefault();
    setPending({ button: submitter, confirmation });
  }

  function proceed(): void {
    if (!pending) return;
    const form = formRef.current;
    const button = pending.button;
    setPending(null);
    if (form) form.requestSubmit(button);
  }

  return (
    <div
      className={pending ? "confirm-intent-form confirm-intent-form--open" : "confirm-intent-form"}
    >
      <form action={action} className={formClassName} onSubmit={handleSubmit} ref={formRef}>
        {children}
      </form>
      {pending && (
        <div
          className="confirm-intent-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-intent-title"
        >
          <h3 id="confirm-intent-title">{pending.confirmation.label}</h3>
          <p>{pending.confirmation.prompt}</p>
          {pending.confirmation.description && (
            <p className="confirm-intent-description">{pending.confirmation.description}</p>
          )}
          <div className="confirm-intent-actions">
            <button className="button-link" onClick={proceed} type="button">
              Confirm
            </button>
            <button className="button-secondary" onClick={() => setPending(null)} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
