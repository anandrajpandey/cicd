import { IncidentTable } from "../components/incident-table";
import { AdminShell, MetricCard } from "../components/shell";
import { analyticsSnapshot, incidents } from "../lib/mock-data";

const DashboardPage = () => (
  <AdminShell
    title="Pipeline Command Center"
    subtitle="A dark-blue operations surface with green signal accents for live risk, debate progress, and human approval load."
  >
    <MetricCard
      label="Pipeline Health"
      value={`${analyticsSnapshot.healthScore}%`}
      detail="Composite health score across active repositories."
    />
    <MetricCard
      label="High-Risk Incidents"
      value={String(analyticsSnapshot.riskDistribution.high)}
      detail="Incidents routed to rapid escalation."
    />
    <MetricCard
      label="SLA Compliance"
      value={`${Math.round(analyticsSnapshot.slaCompliance * 100)}%`}
      detail="Approval and remediation windows met in the last cycle."
    />
    <IncidentTable incidents={incidents} />
  </AdminShell>
);

export default DashboardPage;
