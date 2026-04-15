import { Suspense } from "react";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-500">Loading admin...</div>}>
      <AdminDashboard />
    </Suspense>
  );
}