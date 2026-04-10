import { GitHubConnectCard } from "../components/github-connect-card";
import { getGitHubConnectStatus } from "../lib/github-connect-status";
import { IncidentTable } from "../components/incident-table";
import { RepositoryList } from "../components/repository-list";
import { AdminShell, MetricCard } from "../components/shell";
import { getAnalyticsData, getConnectedRepositories, getIncidentListData } from "../lib/data";

const DashboardPage = async ({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [analytics, incidentList, repositories] = await Promise.all([
    getAnalyticsData(),
    getIncidentListData(),
    getConnectedRepositories()
  ]);
  const status = getGitHubConnectStatus({
    connected: typeof resolvedSearchParams?.connected === "string" ? resolvedSearchParams.connected : undefined,
    synced: typeof resolvedSearchParams?.synced === "string" ? resolvedSearchParams.synced : undefined,
    account: typeof resolvedSearchParams?.account === "string" ? resolvedSearchParams.account : undefined,
    error: typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : undefined
  });

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
      {repositories.length === 0 ? (
        <GitHubConnectCard status={status} />
      ) : (
        <RepositoryList repositories={repositories.slice(0, 8)} />
      )}
      <IncidentTable incidents={incidentList} />
    </AdminShell>
  );
};

export default DashboardPage;
