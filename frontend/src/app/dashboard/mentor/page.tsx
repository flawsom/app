import { Suspense } from "react";
import MentorDashboard from "./MentorDashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Mentor...</div>}>
      <MentorDashboard />
    </Suspense>
  );
}