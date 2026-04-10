import { GitHubConnectCard } from "../../components/github-connect-card";
import { RepositoryList } from "../../components/repository-list";
import { AdminShell, MetricCard } from "../../components/shell";
import { getConnectedRepositories } from "../../lib/data";
import { getGitHubConnectStatus } from "../../lib/github-connect-status";

const RepositoriesPage = async ({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const repositories = await getConnectedRepositories();
  const status = getGitHubConnectStatus({
    connected: typeof resolvedSearchParams?.connected === "string" ? resolvedSearchParams.connected : undefined,
    synced: typeof resolvedSearchParams?.synced === "string" ? resolvedSearchParams.synced : undefined,
    account: typeof resolvedSearchParams?.account === "string" ? resolvedSearchParams.account : undefined,
    error: typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : undefined
  });

  return (
    <AdminShell
      title="Repositories"
      subtitle="Connect GitHub first, then review every repository available to the linked account from one place."
    >
      <MetricCard
        label="Connected Repositories"
        value={String(repositories.length)}
        detail="Repositories synced into the control center."
      />
      <MetricCard
        label="Private Repositories"
        value={String(repositories.filter((repository) => repository.isPrivate).length)}
        detail="Private repositories currently visible to the connected account."
      />
      <MetricCard
        label="GitHub Provider"
        value={repositories.length > 0 ? "Connected" : "Pending"}
        detail="Use the connect prompt below to refresh the repository inventory."
      />
      <GitHubConnectCard status={status} />
      <RepositoryList repositories={repositories} />
    </AdminShell>
  );
};

export default RepositoriesPage;
