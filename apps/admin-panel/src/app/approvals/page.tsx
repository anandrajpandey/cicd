import { AdminShell, MetricCard } from "../../components/shell";
import { approvals } from "../../lib/mock-data";

const ApprovalsPage = () => (
  <AdminShell
    title="Approval Queue"
    subtitle="Pending MEDIUM and HIGH decisions are grouped with SLA countdowns so approvers can clear risk in order."
  >
    {approvals.map((approval) => (
      <MetricCard
        key={approval.id}
        label={approval.repository}
        value={`${approval.slaMinutesRemaining}m`}
        detail={`${approval.riskTier} risk decision awaiting approval`}
      />
    ))}
  </AdminShell>
);

export default ApprovalsPage;
