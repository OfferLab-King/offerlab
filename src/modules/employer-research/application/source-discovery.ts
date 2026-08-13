import type { TransactionSql } from "postgres";

import {
  atsPlatformFromResearchText,
  fingerprintCareersUrl,
  platformLabel,
  type AtsPlatform,
  type UrlFingerprint,
} from "../domain/ats-fingerprint";
import type {
  DiscoveryCandidate,
  PlatformCoverageSourceData,
  PromotionWrite,
} from "../infrastructure/discovery-repository";
import {
  promoteCandidateToSource,
  updateCandidateFingerprint,
} from "../infrastructure/discovery-repository";

// ---------------------------------------------------------------------------
// Platform coverage analytics
// ---------------------------------------------------------------------------

export type PlatformCoverageRow = Readonly<{
  platform: AtsPlatform;
  employers: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  verified: number;
  live: number;
}>;

export type PlatformCoverage = Readonly<{
  rows: readonly PlatformCoverageRow[];
  totals: Readonly<{
    employers: number;
    p0: number;
    p1: number;
    p2: number;
    p3: number;
    verified: number;
    live: number;
  }>;
}>;

function mappedPlatform(value: string | null): AtsPlatform {
  return atsPlatformFromResearchText(value);
}

type PlatformCoverageAccumulator = {
  platform: AtsPlatform;
  employers: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  verified: number;
  live: number;
};

export function computePlatformCoverage(data: PlatformCoverageSourceData): PlatformCoverage {
  const candidatesByCompany = new Map<string, { hint: string | null; verified: boolean }[]>();
  for (const candidate of data.candidates) {
    if (!candidate.companyId) continue;
    const list = candidatesByCompany.get(candidate.companyId) ?? [];
    list.push({
      hint: candidate.platformHint,
      verified: candidate.status === "verified" || candidate.status === "promoted",
    });
    candidatesByCompany.set(candidate.companyId, list);
  }
  const sourcesByCompany = new Map<string, string[]>();
  for (const source of data.jobSources) {
    if (!source.companyId || !source.atsProvider) continue;
    const list = sourcesByCompany.get(source.companyId) ?? [];
    list.push(source.atsProvider);
    sourcesByCompany.set(source.companyId, list);
  }

  const rowMap = new Map<AtsPlatform, PlatformCoverageAccumulator>();
  const add = (platform: AtsPlatform) => {
    if (!rowMap.has(platform)) {
      rowMap.set(platform, {
        platform,
        employers: 0,
        p0: 0,
        p1: 0,
        p2: 0,
        p3: 0,
        verified: 0,
        live: 0,
      });
    }
  };

  for (const snapshot of data.snapshots) {
    if (!snapshot.companyId) continue;
    const sources = sourcesByCompany.get(snapshot.companyId) ?? [];
    const candidates = candidatesByCompany.get(snapshot.companyId) ?? [];
    let platform: AtsPlatform;
    if (sources.length > 0) {
      platform = mappedPlatform([...sources].sort()[0]!);
    } else if (candidates.length > 0) {
      const hints = [...new Set(candidates.map((candidate) => candidate.hint).filter(Boolean))]
        .sort()
        .map(mappedPlatform)
        .filter((value) => value !== "unknown");
      platform = hints[0] ?? "unknown";
    } else {
      platform = mappedPlatform(snapshot.atsPlatform);
    }
    add(platform);
    const row = rowMap.get(platform)!;
    row.employers += 1;
    if (snapshot.tier === "P0") row.p0 += 1;
    else if (snapshot.tier === "P1") row.p1 += 1;
    else if (snapshot.tier === "P2") row.p2 += 1;
    else if (snapshot.tier === "P3") row.p3 += 1;
    if (candidates.some((candidate) => candidate.verified)) row.verified += 1;
    if (sources.length > 0) row.live += 1;
  }

  const rows: readonly PlatformCoverageRow[] = [...rowMap.values()]
    .sort((a, b) => b.employers - a.employers || a.platform.localeCompare(b.platform))
    .map((row) => ({ ...row }));
  const totals = {
    employers: 0,
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    verified: 0,
    live: 0,
  };
  for (const row of rows) {
    totals.employers += row.employers;
    totals.p0 += row.p0;
    totals.p1 += row.p1;
    totals.p2 += row.p2;
    totals.p3 += row.p3;
    totals.verified += row.verified;
    totals.live += row.live;
  }
  return { rows, totals };
}

// ---------------------------------------------------------------------------
// Fingerprint planning (pure)
// ---------------------------------------------------------------------------

export type CandidateFingerprintPlan = Readonly<{
  candidateId: string;
  companyName: string;
  url: string;
  fingerprint: UrlFingerprint;
  previousStatus: string;
  nextStatus: string;
  changed: boolean;
  reason: string;
}>;

export function planCandidateFingerprint(candidate: DiscoveryCandidate): CandidateFingerprintPlan {
  const fingerprint = fingerprintCareersUrl(candidate.candidateUrl);
  const previousStatus = candidate.status;
  const platformText = platformLabel(fingerprint.platform);
  let nextStatus = previousStatus;
  let reason: string;

  if (fingerprint.platform === "unknown") {
    if (previousStatus === "not_researched") {
      nextStatus = "candidate_found";
      reason = "candidate URL known; no platform signature";
    } else {
      nextStatus = previousStatus;
      reason = "no platform signature; status preserved";
    }
  } else if (
    candidate.platformHint?.trim().toLowerCase() !== platformText.toLowerCase() ||
    previousStatus === "not_researched" ||
    previousStatus === "candidate_found"
  ) {
    nextStatus =
      previousStatus === "verified" || previousStatus === "promoted"
        ? previousStatus
        : "platform_identified";
    reason = `${fingerprint.evidence.join("; ")} (${fingerprint.confidence} confidence)`;
  } else {
    nextStatus = previousStatus;
    reason = `platform unchanged (${platformText})`;
  }

  return {
    candidateId: candidate.candidateId,
    companyName: candidate.companyName,
    url: candidate.candidateUrl,
    fingerprint,
    previousStatus,
    nextStatus,
    changed: nextStatus !== previousStatus || candidate.platformHint !== platformText,
    reason,
  };
}

export function planDiscoveryFingerprints(
  candidates: readonly DiscoveryCandidate[],
): readonly CandidateFingerprintPlan[] {
  return [...candidates]
    .map(planCandidateFingerprint)
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export async function applyCandidateFingerprintPlans(
  database: TransactionSql,
  plans: readonly CandidateFingerprintPlan[],
  apply: boolean,
): Promise<{ planned: number; applied: number; unchanged: number }> {
  let appliedCount = 0;
  let unchangedCount = 0;
  for (const plan of plans) {
    if (!plan.changed) {
      unchangedCount += 1;
      continue;
    }
    if (!apply) continue;
    const outcome = await updateCandidateFingerprint(database, plan.candidateId, {
      platform: plan.fingerprint.platform,
      confidence: plan.fingerprint.confidence,
      evidence: plan.fingerprint.evidence,
      status: plan.nextStatus,
    });
    if (outcome === "updated") appliedCount += 1;
    else unchangedCount += 1;
  }
  return { planned: plans.length, applied: appliedCount, unchanged: unchangedCount };
}

// ---------------------------------------------------------------------------
// Promotion planning (pure)
// ---------------------------------------------------------------------------

export type PromotionPlan = Readonly<{
  candidateId: string;
  companyId: string;
  companyName: string;
  url: string;
  platform: AtsPlatform;
  channel: string;
  promotable: boolean;
  reason: string;
}>;

export function planCandidatePromotion(candidate: DiscoveryCandidate): PromotionPlan {
  const fingerprint = fingerprintCareersUrl(candidate.candidateUrl);
  const verified = candidate.status === "verified" || candidate.verifiedAt !== null;
  const platform = fingerprint.platform;
  if (!verified) {
    return {
      candidateId: candidate.candidateId,
      companyId: candidate.companyId,
      companyName: candidate.companyName,
      url: candidate.candidateUrl,
      platform,
      channel: candidate.channel,
      promotable: false,
      reason: "candidate is not verified",
    };
  }
  if (platform === "unknown" || fingerprint.confidence !== "high") {
    return {
      candidateId: candidate.candidateId,
      companyId: candidate.companyId,
      companyName: candidate.companyName,
      url: candidate.candidateUrl,
      platform,
      channel: candidate.channel,
      promotable: false,
      reason: `platform fingerprint not high confidence (${platform})`,
    };
  }
  return {
    candidateId: candidate.candidateId,
    companyId: candidate.companyId,
    companyName: candidate.companyName,
    url: candidate.candidateUrl,
    platform,
    channel: candidate.channel,
    promotable: true,
    reason: `verified ${platformLabel(platform)} candidate`,
  };
}

export function planCandidatePromotions(
  candidates: readonly DiscoveryCandidate[],
): readonly PromotionPlan[] {
  return [...candidates]
    .map(planCandidatePromotion)
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export async function applyCandidatePromotions(
  database: TransactionSql,
  plans: readonly PromotionPlan[],
  apply: boolean,
): Promise<{
  planned: number;
  created: number;
  alreadyPresent: number;
  skipped: number;
}> {
  let created = 0;
  let alreadyPresent = 0;
  let skipped = 0;
  for (const plan of plans) {
    if (!plan.promotable) {
      skipped += 1;
      continue;
    }
    if (!apply) continue;
    const write: PromotionWrite = {
      candidateId: plan.candidateId,
      companyId: plan.companyId,
      companyName: plan.companyName,
      candidateUrl: plan.url,
      platform: plan.platform,
      channel: plan.channel,
      notes: `Promoted from source discovery; verified ${platformLabel(plan.platform)} candidate (${plan.reason}).`,
    };
    const outcome = await promoteCandidateToSource(database, write);
    if (outcome === "created") created += 1;
    else if (outcome === "already_present") alreadyPresent += 1;
    else skipped += 1;
  }
  return { planned: plans.length, created, alreadyPresent, skipped };
}

export function formatDiscoveryReport(
  fingerprints: readonly CandidateFingerprintPlan[],
  fingerprintOutcome: { planned: number; applied: number; unchanged: number },
  promotions: readonly PromotionPlan[],
  promotionOutcome: { planned: number; created: number; alreadyPresent: number; skipped: number },
  dryRun: boolean,
): string {
  const platformCounts = new Map<string, number>();
  for (const plan of fingerprints) {
    const key = platformLabel(plan.fingerprint.platform);
    platformCounts.set(key, (platformCounts.get(key) ?? 0) + 1);
  }
  const lines = [
    `\n== Source discovery report ==`,
    `mode: ${dryRun ? "dry run (no writes)" : "applied"}`,
    `candidates fingerprinted: ${fingerprints.length}`,
    ...[...platformCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => `  ${platform}: ${count}`),
    `fingerprint changes: ${fingerprintOutcome.applied} applied / ${fingerprintOutcome.unchanged} unchanged / ${fingerprintOutcome.planned} planned`,
    `promotions: ${promotionOutcome.created} created / ${promotionOutcome.alreadyPresent} already present / ${promotionOutcome.skipped} skipped / ${promotionOutcome.planned} planned`,
  ];
  const changed = fingerprints.filter((plan) => plan.changed);
  if (changed.length > 0) {
    lines.push("", "fingerprint changes:");
    for (const plan of changed.slice(0, 40)) {
      lines.push(
        `  ${plan.companyName}: ${plan.previousStatus} -> ${plan.nextStatus} (${plan.reason})`,
      );
    }
    if (changed.length > 40) lines.push(`  ... and ${changed.length - 40} more`);
  }
  const promotable = promotions.filter((plan) => plan.promotable);
  if (promotable.length > 0) {
    lines.push("", "promotable candidates (create paused sources):");
    for (const plan of promotable) {
      lines.push(`  ${plan.companyName}: ${platformLabel(plan.platform)} @ ${plan.url}`);
    }
  }
  return lines.join("\n");
}
