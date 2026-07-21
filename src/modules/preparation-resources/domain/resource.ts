import { z } from "zod";

export const resourceTypes = [
  "guide",
  "checklist",
  "template",
  "video",
  "exercise",
  "article",
] as const;
export const accessLevels = ["public", "member"] as const;
export const publicationStates = ["draft", "published", "archived"] as const;
export const controlledLinkTypes = ["download", "external", "template_copy"] as const;

export const SEARCH_QUERY_LIMIT = 120;
export const LIBRARY_PAGE_SIZE = 12;
const reservedSlugs = new Set(["admin", "api", "auth", "member", "new", "preview", "sign-in"]);

export function normalizeSingleLine(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function normalizeMarkdown(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/gu, "\n").trim();
}

export function normalizeSearch(value: string | null): string {
  const normalized = normalizeSingleLine(value ?? "");
  if (normalized.length > SEARCH_QUERY_LIMIT || /[\u0000-\u001f\u007f]/u.test(normalized))
    return "";
  return normalized;
}

export const slugSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !reservedSlugs.has(slug), "This slug is reserved.");

export function parseYouTubeVideoId(input: string | null | undefined): string | null {
  const value = normalizeSingleLine(input ?? "");
  if (!value) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : (url.pathname.match(/^\/embed\/([^/]+)$/)?.[1] ?? null);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function repeatedlyDecode(value: string): string {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function normalizeControlledUrl(input: string): string | null {
  const value = input.normalize("NFC").trim();
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const probe = repeatedlyDecode(value)
    .replace(/[\s\u0000-\u001f\u007f]+/gu, "")
    .toLowerCase();
  if (/^(?:javascript|data|file):/u.test(probe) || value.startsWith("//")) return null;
  if (value.startsWith("/")) {
    if (!/^\/[A-Za-z0-9/_?&=.#%~-]*$/u.test(value) || value.startsWith("/\\")) return null;
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSafeMarkdownHref(input: string): boolean {
  const value = input.normalize("NFC").trim();
  if (
    !value ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    return false;
  const probe = repeatedlyDecode(value)
    .replace(/[\s\u0000-\u001f\u007f]+/gu, "")
    .toLowerCase();
  if (/^(?:javascript|data|file):/u.test(probe)) return false;
  if (value.startsWith("/")) return /^\/[A-Za-z0-9/_?&=.#%~-]*$/u.test(value);
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

const controlledText = (maximum: number) =>
  z
    .string()
    .transform(normalizeSingleLine)
    .pipe(
      z
        .string()
        .min(1)
        .max(maximum)
        .refine((v) => !/[\u0000-\u001f\u007f]/u.test(v)),
    );
const controlledDraftText = (maximum: number) =>
  z
    .string()
    .transform(normalizeSingleLine)
    .pipe(
      z
        .string()
        .max(maximum)
        .refine((v) => !/[\u0000-\u001f\u007f]/u.test(v)),
    );

export const controlledLinkSchema = z
  .object({
    label: controlledText(120),
    type: z.enum(controlledLinkTypes),
    url: z.string().transform((value, context) => {
      const normalized = normalizeControlledUrl(value);
      if (!normalized) {
        context.addIssue({
          code: "custom",
          message: "Use an approved relative path or HTTPS URL.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  })
  .strict();

export const resourceDraftSchema = z
  .object({
    accessLevel: z.enum(accessLevels),
    estimatedMinutes: z.number().int().min(1).max(600).nullable(),
    markdownBody: z
      .string()
      .max(100_000)
      .transform(normalizeMarkdown)
      .refine((v) => !/[\u0000\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v)),
    primaryCategoryId: z.string().uuid().nullable(),
    resourceType: z.enum(resourceTypes),
    shortDescription: controlledDraftText(500),
    slug: slugSchema,
    title: controlledDraftText(160),
    youtubeVideo: z.string().max(2048).nullable().optional(),
  })
  .strict();

export type ResourceType = (typeof resourceTypes)[number];
export type AccessLevel = (typeof accessLevels)[number];
