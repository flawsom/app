import { Suspense } from "react";
import EmployerDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Employer...</div>}>
      <EmployerDashboard />
    </Suspense>
  );
}