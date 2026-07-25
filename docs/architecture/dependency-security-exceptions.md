# Dependency security exceptions

## `brace-expansion` denial of service advisory

- **Recorded:** 26 July 2026
- **Advisory:** GHSA-mh99-v99m-4gvg
- **Current finding:** `brace-expansion@1.1.16` through `minimatch@3.1.5`, pinned transitively by ESLint 9.39.5 and its configuration packages.
- **Exposure:** Development-only lint tooling. It is not part of the deployed Next.js runtime or a member-facing input path.
- **Mitigation:** The independent modern dependency path resolves to patched `brace-expansion@5.0.8`. Do not pass untrusted glob patterns to local lint commands. CI remains the normal caller of ESLint with repository-owned configuration and file paths.
- **Decision:** Temporarily accept this transitive development-tool finding. Do not force an incompatible package override across the older `minimatch` API.
- **Review trigger:** Remove this exception as soon as the supported ESLint dependency chain upgrades the older `minimatch` path, or immediately if the package becomes reachable from production code or untrusted input.

`pnpm security:audit` is expected to remain non-zero while this exception is active; `pnpm why brace-expansion` must continue to show that the vulnerable version is confined to the ESLint toolchain.
