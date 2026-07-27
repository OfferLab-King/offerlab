import { requireAdministrator } from "../../modules/identity-access/application/authorization";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdministrator();
  return <AdminShell>{children}</AdminShell>;
}
