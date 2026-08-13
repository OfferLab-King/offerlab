"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { promoteCandidateForAdmin } from "../../../modules/employer-research/application/employer-research";

const promoteSchema = z.object({
  candidateId: z.string().uuid(),
});

export async function promoteVerifiedCandidate(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = promoteSchema.parse({
    candidateId: formData.get("candidateId"),
  });
  await promoteCandidateForAdmin(administrator.userId, parsed.candidateId);
  revalidatePath("/admin/source-discovery");
}
