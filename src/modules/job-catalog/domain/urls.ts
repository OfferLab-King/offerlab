const trackingQueryParameters = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "dclid",
  "fbclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "ref_url",
  "referrer",
  "source",
  "campaign",
  "sid",
  "yclid",
  "ttclid",
  "li_fat_id",
  "vero_id",
  "vero_conv",
  "vero_event",
  "s_kwcid",
  "sc_cid",
  "wickedid",
  "cjevent",
  "aff_id",
  "aff_sub",
  "subid",
  "wbraid",
  "gbraid",
  "gh_src",
  "rts",
  "jbl",
  "via",
]);

export function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function canonicalizeJobUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const params = new URLSearchParams();
  for (const [key, item] of url.searchParams.entries()) {
    if (!trackingQueryParameters.has(key.toLowerCase())) params.append(key, item);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return `${url.origin}${url.pathname.replace(/\/+$/u, "")}${query}`;
}

export function urlHostname(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./u, "");
  } catch {
    return null;
  }
}

const slugCleanup = /[^a-z0-9]+/gu;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(slugCleanup, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80)
    .replace(/^-+|-+$/gu, "");
}

export function slugifyTitle(title: string, companySlug: string): string {
  const titleSlug = slugify(title);
  return `${companySlug}-${titleSlug || "role"}`.slice(0, 150);
}
