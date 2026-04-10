import { AdminShell, MetricCard } from "../../../components/shell";
import { getIncidentDetailData } from "../../../lib/data";

const IncidentDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const incident = await getIncidentDetailData(id);

  return (
    <AdminShell
      title={`Incident ${incident?.id ?? "Unknown"}`}
      subtitle="Specialist findings, debate rebuttals, and the Judge summary are presented side by side for quick triage."
    >
      <MetricCard label="Repository" value={incident?.repository ?? "n/a"} detail={incident?.failureType ?? "Unknown"} />
      <MetricCard label="Risk Tier" value={incident?.riskTier ?? "n/a"} detail={incident?.summary ?? "No summary"} />
      <MetricCard
        label="Judge Reasoning"
        value={incident?.decision ? incident.decision.compositeScore.toFixed(2) : "n/a"}
        detail={incident?.decision?.reasoning ?? "No synthesized reasoning yet."}
      />
    </AdminShell>
  );
};

export default IncidentDetailPage;
