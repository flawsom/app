import { Suspense } from "react";
import PlacementDashboard from "./PlacementDashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading Placement...</div>}>
      <PlacementDashboard />
    </Suspense>
  );
}