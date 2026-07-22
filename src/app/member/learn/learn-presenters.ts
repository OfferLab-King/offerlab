import type {
  MemberPath,
  PathSection,
} from "../../../modules/learning-paths/infrastructure/learning-path-repository";

export type LearnDestination = "overview" | "paths" | "resources";

export function learnDestination(pathname: string): LearnDestination {
  if (pathname.startsWith("/member/learn/paths")) return "paths";
  if (pathname === "/member/learn/resources" || pathname.startsWith("/member/learn/resources/"))
    return "resources";
  return "overview";
}

export function selectContinuePreparation(paths: readonly MemberPath[]): MemberPath | null {
  return paths.find((path) => path.following && path.progress < 100) ?? null;
}

export function resourceAction(completed: boolean): "Review" | "Start" {
  return completed ? "Review" : "Start";
}

export function planAction(path: Pick<MemberPath, "completedCount" | "progress">) {
  if (path.progress === 100) return "Review" as const;
  return path.completedCount > 0 ? ("Continue" as const) : ("Start" as const);
}

export type PreparationAreaStatus = "Not started" | "In progress" | "Ready";

export function preparationAreaProgress(section: PathSection) {
  const completedCount = section.items.filter((item) => item.completedAt).length;
  const totalCount = section.items.length;
  const status: PreparationAreaStatus =
    completedCount === 0 ? "Not started" : completedCount === totalCount ? "Ready" : "In progress";
  return { completedCount, status, totalCount } as const;
}

export function readyAreaCount(path: Pick<MemberPath, "sections">) {
  return path.sections.filter((section) => preparationAreaProgress(section).status === "Ready")
    .length;
}

export function nextPreparationArea(path: Pick<MemberPath, "sections">) {
  return (
    path.sections.find((section) => preparationAreaProgress(section).status !== "Ready") ?? null
  );
}

export function preparationAreaPreview(path: Pick<MemberPath, "sections">, limit = 4) {
  const headings = path.sections.map((section) => section.heading);
  return { headings: headings.slice(0, limit), remaining: Math.max(0, headings.length - limit) };
}

export function estimatedDuration(minutes: number) {
  if (!minutes) return "Flexible timing";
  const rounded = Math.ceil(minutes / 5) * 5;
  return `About ${rounded} min`;
}
