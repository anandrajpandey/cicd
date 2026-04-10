import { IncidentTable } from "../components/incident-table";
import { AdminShell, MetricCard } from "../components/shell";
import { getAnalyticsData, getIncidentListData } from "../lib/data";

const DashboardPage = async () => {
  const [analytics, incidentList] = await Promise.all([getAnalyticsData(), getIncidentListData()]);

  return (
    <AdminShell
      title="Pipeline Command Center"
      subtitle="A dark-blue operations surface with green signal accents for live risk, debate progress, and human approval load."
    >
      <MetricCard
        label="Pipeline Health"
        value={`${analytics.healthScore}%`}
        detail="Composite health score across active repositories."
      />
      <MetricCard
        label="High-Risk Incidents"
        value={String(analytics.riskDistribution.high)}
        detail="Incidents routed to rapid escalation."
      />
      <MetricCard
        label="SLA Compliance"
        value={`${Math.round(analytics.slaCompliance * 100)}%`}
        detail="Approval and remediation windows met in the last cycle."
      />
      <IncidentTable incidents={incidentList} />
    </AdminShell>
  );
};

export default DashboardPage;
