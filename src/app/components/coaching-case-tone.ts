import type { CSSProperties } from "react";

type CoachingCaseToneStyle = CSSProperties & Readonly<{ "--case-comment-hue": string }>;

const GOLDEN_ANGLE = 137.508;

export function coachingCaseTone(index: number): CoachingCaseToneStyle {
  const hue = Math.round((42 + Math.max(0, index) * GOLDEN_ANGLE) % 360);
  return { "--case-comment-hue": String(hue) };
}
