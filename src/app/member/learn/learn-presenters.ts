import type { MemberPath } from "../../../modules/learning-paths/infrastructure/learning-path-repository";

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
