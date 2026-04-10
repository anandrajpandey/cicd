import { AdminShell, MetricCard } from "../../components/shell";

const SettingsPage = () => (
  <AdminShell
    title="Settings"
    subtitle="Tune risk thresholds, agent weights, and notification routing without leaving the control panel."
  >
    <MetricCard label="Low Risk Max" value="0.35" detail="Threshold used for immediate remediation." />
    <MetricCard label="Medium Risk Max" value="0.70" detail="Upper boundary before escalation to high risk." />
    <MetricCard label="Notification Mode" value="Slack + PagerDuty" detail="Current alerting combination for routed incidents." />
  </AdminShell>
);

export default SettingsPage;
