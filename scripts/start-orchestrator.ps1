$ErrorActionPreference = "Stop"
Set-Location "C:\Users\pc\Desktop\Projects\Latest"

$env:PORT = "4000"
$env:KAFKA_BROKERS = "localhost:9092"
$env:GITHUB_WEBHOOK_SECRET = "replace_with_github_webhook_secret"
$env:JENKINS_TOKEN = "replace_with_jenkins_token"

corepack pnpm --filter @apps/orchestrator exec node dist/index.js
