import { AdminShell, MetricCard } from "../../../components/shell";
import { getApprovalDetailData } from "../../../lib/data";

const ApprovalDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const approval = await getApprovalDetailData(id);

  return (
    <AdminShell
      title={`Approval ${approval?.id ?? "Unknown"}`}
      subtitle="Approvers can review the full debate context here and submit approve, reject, or override actions with justification."
    >
      <MetricCard label="Repository" value={approval?.repository ?? "n/a"} detail="Pending approval decision" />
      <MetricCard label="Risk Tier" value={approval?.riskTier ?? "n/a"} detail="Human sign-off required before remediation." />
      <MetricCard
        label="SLA Remaining"
        value={`${approval?.slaMinutesRemaining ?? 0}m`}
        detail={approval?.decisionReasoning ?? "Countdown for approval response."}
      />
    </AdminShell>
  );
};

export default ApprovalDetailPage;
