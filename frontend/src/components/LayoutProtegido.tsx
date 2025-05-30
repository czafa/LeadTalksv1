import { ReactNode } from "react";
import { useSessaoCleanup } from "../hooks/useSessaoCleanup";

type Props = {
  children: ReactNode;
};

export default function LayoutProtegido({ children }: Props) {
  useSessaoCleanup();

  return <>{children}</>;
}
