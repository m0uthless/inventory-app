import * as React from "react";
import { useAuth } from "./AuthProvider";

export function Can(props: { perm?: string; group?: string; children: React.ReactNode }) {
  const { hasPerm, inGroup } = useAuth();
  const ok =
    (props.perm ? hasPerm(props.perm) : true) &&
    (props.group ? inGroup(props.group) : true);

  if (!ok) return null;
  return <>{props.children}</>;
}
