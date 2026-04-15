import { Suspense } from "react";
import StudentDashboard from "./StudentDashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Student...</div>}>
      <StudentDashboard />
    </Suspense>
  );
}