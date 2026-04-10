import { AdminShell, MetricCard } from "../../components/shell";
import { analyticsSnapshot } from "../../lib/mock-data";

const AnalyticsPage = () => (
  <AdminShell
    title="Analytics"
    subtitle="Agent confidence, SLA performance, and risk distribution are framed with high-contrast dark-blue panels and green signal copy."
  >
    <MetricCard
      label="Build Accuracy"
      value={`${Math.round(analyticsSnapshot.agentAccuracy.build * 100)}%`}
      detail="Historical build-agent precision."
    />
    <MetricCard
      label="Code Accuracy"
      value={`${Math.round(analyticsSnapshot.agentAccuracy.code * 100)}%`}
      detail="Code-review signal accuracy over time."
    />
    <MetricCard
      label="Test Accuracy"
      value={`${Math.round(analyticsSnapshot.agentAccuracy.test * 100)}%`}
      detail="Test-analyzer classification accuracy."
    />
  </AdminShell>
);

export default AnalyticsPage;
