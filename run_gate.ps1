$ErrorActionPreference = "Stop"

Write-Host "Running preflight environment check..."
$envFile = "apps/api/.env"

$nodeRunner = @"
const fs = require('fs');
const util = require('util');
const path = require('path');
const { execSync, spawn } = require('child_process');

let envPath = path.resolve('$envFile');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env');
}

let loadedEnv = {};
if (fs.existsSync(envPath)) {
  loadedEnv = util.parseEnv(fs.readFileSync(envPath, 'utf8'));
}

const env = { ...loadedEnv, ...process.env }; // process.env wins

const requiredVars = ['SUPABASE_URL', 'INVITATION_TOKEN_PEPPER', 'WEB_ORIGIN', 'DATABASE_URL'];
const missingVars = requiredVars.filter(v => !env[v]);
if (missingVars.length > 0) {
  console.log('Preflight failed! Missing variables:');
  missingVars.forEach(v => console.log(' - ' + v));
  process.exit(1);
}

const action = process.argv[1];
const command = process.argv[2];

if (action === 'check') {
  console.log('Environment loaded successfully.');
  process.exit(0);
}

if (action === 'run') {
  try {
    execSync(command, { env, stdio: 'inherit' });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

if (action === 'spawn') {
  // spawn API in background
  const p = spawn(command, process.argv.slice(3), { env, stdio: 'ignore', detached: true, shell: true });
  p.unref();
  process.exit(0);
}
"@

# Note: we save it to a temporary .js file to avoid argument escaping issues in PowerShell
$runnerPath = "run_gate_runner.js"
Set-Content -Path $runnerPath -Value $nodeRunner

node $runnerPath check
if ($LASTEXITCODE -ne 0) { Remove-Item $runnerPath; exit $LASTEXITCODE }

Write-Host "Resetting DB..."
node $runnerPath run "pnpm --filter @projeto/database exec prisma migrate reset --force"
if ($LASTEXITCODE -ne 0) { Remove-Item $runnerPath; exit $LASTEXITCODE }

Write-Host "Validating and Generating Prisma..."
node $runnerPath run "pnpm --filter @projeto/database run prisma:validate"
if ($LASTEXITCODE -ne 0) { Remove-Item $runnerPath; exit $LASTEXITCODE }
node $runnerPath run "pnpm --filter @projeto/database run prisma:generate"
if ($LASTEXITCODE -ne 0) { Remove-Item $runnerPath; exit $LASTEXITCODE }

Write-Host "Building API..."
node $runnerPath run "pnpm --filter api build"
if ($LASTEXITCODE -ne 0) { Remove-Item $runnerPath; exit $LASTEXITCODE }

Write-Host "Starting API in background..."
# PowerShell Start-Process is needed for the gate to own the process without detaching into oblivion, but we can also use Node's child_process. 
# Wait, if we use Node to start it and pipe output to a file or nowhere, we can't kill it easily later unless we get the PID.
# Let's just use PowerShell to start a Node script that starts the API and keeps running? No, we can just use PowerShell's Start-Process with `node --env-file`.
Write-Host "Starting API in background..."
$apiProcess = Start-Process -FilePath "node" -ArgumentList "--env-file=apps/api/.env", "apps/api/dist/main.js" -WorkingDirectory "$PWD" -PassThru -NoNewWindow

Write-Host "Waiting for API to be ready..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/health/live" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response -and $response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $ready) {
    Write-Host "API failed to start in time!"
    Stop-Process -Id $apiProcess.Id -Force
    Remove-Item $runnerPath -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "API is ready. Running tests..."

$commands = @(
    "pnpm --filter @projeto/database test:integration",
    "pnpm --filter api test:integration:tenants",
    "pnpm --filter api test:integration:tenant-context",
    "pnpm --filter api test:integration:memberships",
    "pnpm --filter api test:integration:invitations",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm audit --json"
)

$finalExitCode = 0

try {
    foreach ($cmd in $commands) {
        Write-Host "Running: $cmd"
        node $runnerPath run "$cmd"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAILED: $cmd with code $LASTEXITCODE"
            # Collect-all policy: we continue even if failed to get the final audit, but we record the failure.
            $finalExitCode = $LASTEXITCODE
        }
    }
} finally {
    Write-Host "Killing API..."
    Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
    Remove-Item $runnerPath -ErrorAction SilentlyContinue
}

Write-Host "Finished with exit code $finalExitCode"
exit $finalExitCode
