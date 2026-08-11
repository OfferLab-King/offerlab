import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  isJobSaved,
  listSavedJobIds,
  saveJob as persistSave,
  unsaveJob as persistUnsave,
} from "../infrastructure/saved-job-repository";
import { readJobsByIds } from "./catalog";

export async function saveJobForMember(ownerId: string, jobId: string): Promise<void> {
  await withApplicationUser(ownerId, (database) => persistSave(database, ownerId, jobId));
}

export async function unsaveJobForMember(ownerId: string, jobId: string): Promise<void> {
  await withApplicationUser(ownerId, (database) => persistUnsave(database, ownerId, jobId));
}

export async function isJobSavedForMember(ownerId: string, jobId: string): Promise<boolean> {
  return withApplicationUser(ownerId, (database) => isJobSaved(database, ownerId, jobId));
}

export async function listSavedJobsForMember(ownerId: string) {
  const ids = await withApplicationUser(ownerId, (database) => listSavedJobIds(database, ownerId));
  if (ids.length === 0) return [];
  const jobs = await readJobsByIds(ids);
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
}
