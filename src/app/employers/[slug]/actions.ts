"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "../../../modules/identity-access/application/authorization";
import {
  saveEmployerForMember,
  unsaveEmployerForMember,
} from "../../../modules/job-catalog/application/saved-employers";

const employerSchema = z.object({
  companyId: z.string().uuid(),
});

export async function saveEmployer(formData: FormData): Promise<void> {
  const member = await requireMember();
  const parsed = employerSchema.parse({ companyId: formData.get("companyId") });
  await saveEmployerForMember(member.userId, parsed.companyId);
  revalidatePath("/employers");
}

export async function unsaveEmployer(formData: FormData): Promise<void> {
  const member = await requireMember();
  const parsed = employerSchema.parse({ companyId: formData.get("companyId") });
  await unsaveEmployerForMember(member.userId, parsed.companyId);
  revalidatePath("/employers");
}
