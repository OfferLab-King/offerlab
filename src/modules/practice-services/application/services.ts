import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  administrationActionSchema,
  offeringAdministrationSchema,
  requestActionSchema,
} from "../domain/service";
import * as repository from "../infrastructure/service-repository";

export const readServiceOfferings = (owner: string) =>
  withApplicationUser(owner, (database) => repository.listOfferings(database, owner));
export const readServiceRequestsForAdmin = (administrator: string) =>
  withApplicationUser(administrator, repository.listRequestsForAdmin);
export const readServiceOfferingsForAdmin = (administrator: string) =>
  withApplicationUser(administrator, repository.listOfferingsForAdmin);

export async function requestService(owner: string, input: unknown) {
  const parsed = requestActionSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" } as const;
  return withApplicationUser(owner, (database) =>
    repository.createRequest(database, owner, parsed.data.offeringId),
  );
}

export const cancelServiceRequest = (owner: string, id: string, version: number) =>
  withApplicationUser(owner, (database) => repository.cancelRequest(database, owner, id, version));

export async function administerServiceRequest(administrator: string, input: unknown) {
  const parsed = administrationActionSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" } as const;
  return withApplicationUser(administrator, (database) =>
    repository.updateRequest(
      database,
      administrator,
      parsed.data.id,
      parsed.data.version,
      parsed.data.status,
    ),
  );
}

export async function administerServiceOffering(administrator: string, input: unknown) {
  const parsed = offeringAdministrationSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" } as const;
  return withApplicationUser(administrator, (database) =>
    repository.updateOfferingAvailability(
      database,
      administrator,
      parsed.data.id,
      parsed.data.version,
      parsed.data.availability,
    ),
  );
}
