export function EmployerMark({
  companyName,
  logoUrl,
  size = "medium",
}: Readonly<{ companyName: string; logoUrl: string | null; size?: "medium" | "small" }>) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos are external ATS-hosted images with unpredictable hosts; next/image would require an unbounded remotePatterns allowlist.
      <img
        alt={`${companyName} logo`}
        className={`job-employer-mark ${size === "small" ? "job-employer-mark-small" : ""}`}
        loading="lazy"
        src={logoUrl}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`job-employer-mark job-employer-mark-fallback ${size === "small" ? "job-employer-mark-small" : ""}`}
    >
      {companyName.charAt(0).toUpperCase()}
    </span>
  );
}
