import type { ReactNode } from "react";

import { MemberApplicationsHeader } from "./applications/member-applications-header";

export default function MemberLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <MemberApplicationsHeader />
      {children}
    </>
  );
}
