import { AdminShell, MetricCard } from "../../../components/shell.js";
import { incidents } from "../../../lib/mock-data.js";

export const IncidentDetailPage = () => {
  const incident = incidents[0];

  return (
    <AdminShell
      title={`Incident ${incident?.id ?? "Unknown"}`}
      subtitle="Specialist findings, debate rebuttals, and the Judge summary are presented side by side for quick triage."
    >
      <MetricCard label="Repository" value={incident?.repository ?? "n/a"} detail={incident?.failureType ?? "Unknown"} />
      <MetricCard label="Risk Tier" value={incident?.riskTier ?? "n/a"} detail={incident?.summary ?? "No summary"} />
      <MetricCard label="Judge Reasoning" value="MEDIUM" detail="Conflicting code and test signals require human review." />
    </AdminShell>
  );
};

export default IncidentDetailPage;
