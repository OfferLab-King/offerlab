"use client";

import { useEffect } from "react";

export function RegistrationUrlCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = url.searchParams.has("invitation");
    url.searchParams.delete("invitation");
    const fragment = new URLSearchParams(url.hash.slice(1));

    if (fragment.has("invitation")) {
      fragment.delete("invitation");
      url.hash = fragment.toString();
      changed = true;
    }

    if (changed) window.history.replaceState(window.history.state, "", url);
  }, []);

  return null;
}
