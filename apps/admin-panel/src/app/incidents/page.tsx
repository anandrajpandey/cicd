import { IncidentTable } from "../../components/incident-table";
import { AdminShell } from "../../components/shell";
import { getIncidentListData } from "../../lib/data";

const IncidentsPage = async () => {
  const incidents = await getIncidentListData();

  return (
    <AdminShell
      title="Incident Ledger"
      subtitle="Browse every pipeline incident with risk badges, repository context, and the latest synthesized summary."
    >
      <IncidentTable incidents={incidents} />
    </AdminShell>
  );
};

export default IncidentsPage;
