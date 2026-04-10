import { GitHubConnectCard } from "../components/github-connect-card";
import { IncidentTable } from "../components/incident-table";
import { RepositoryList } from "../components/repository-list";
import { AdminShell, MetricCard } from "../components/shell";
import { getAnalyticsData, getConnectedRepositories, getIncidentListData } from "../lib/data";

const DashboardPage = async () => {
  const [analytics, incidentList, repositories] = await Promise.all([
    getAnalyticsData(),
    getIncidentListData(),
    getConnectedRepositories()
  ]);

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
      <MetricCard
        label="Connected Repositories"
        value={String(repositories.length)}
        detail="Repositories currently available from the connected GitHub account."
      />
      {repositories.length === 0 ? <GitHubConnectCard /> : <RepositoryList repositories={repositories.slice(0, 8)} />}
      <IncidentTable incidents={incidentList} />
    </AdminShell>
  );
};

export default DashboardPage;
