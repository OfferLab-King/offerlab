import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { CmsShell } from "./cms-shell";

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireAdministrator();
  return <CmsShell>{children}</CmsShell>;
}
