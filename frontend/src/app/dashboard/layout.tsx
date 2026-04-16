import { Suspense } from "react";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Loading Dashboard...</div>}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}