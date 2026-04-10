import { GitHubConnectCard } from "../../components/github-connect-card";
import { RepositoryList } from "../../components/repository-list";
import { AdminShell, MetricCard } from "../../components/shell";
import { getConnectedRepositories } from "../../lib/data";

const RepositoriesPage = async () => {
  const repositories = await getConnectedRepositories();

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
      <GitHubConnectCard />
      <RepositoryList repositories={repositories} />
    </AdminShell>
  );
};

export default RepositoriesPage;
