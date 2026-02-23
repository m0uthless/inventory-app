import * as React from "react";

import { useAuth } from "./AuthProvider";

type Props = {
  perm?: string;
  group?: string;
  children: React.ReactNode;
};

export function Can({ perm, group, children }: Props) {
  const { hasPerm, inGroup } = useAuth();

  const ok = (perm ? hasPerm(perm) : true) && (group ? inGroup(group) : true);
  if (!ok) return null;

  return <>{children}</>;
}
