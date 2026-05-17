import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import * as dotenv from 'dotenv';
import { AttackerAgent } from './src/attackerAgent.js';
import { RemediationAgent } from './src/remediationAgent.js';
import { getCursorApiKey } from './src/cursorConfig.js';

dotenv.config();

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.join(ROOT, 'target-app');
const SERVER_FILE_PATH = path.join(TARGET_DIR, 'server.js');
const PORT = Number(process.env.PORT) || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const HEALTH_URL = `${BASE_URL}/health`;
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

let targetProcess: ChildProcess | undefined;

function log(message: string): void {
  console.log(`[orchestrator] ${message}`);
}

function startTargetApp(): ChildProcess {
  log(`Starting target-app on port ${PORT}...`);

  const child = spawn('npm', ['start'], {
    cwd: TARGET_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[target-app] ${chunk.toString()}`);
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[target-app] ${chunk.toString()}`);
  });

  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      log(`target-app exited with code ${code}`);
    } else if (signal) {
      log(`target-app killed by signal ${signal}`);
    }
  });

  return child;
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        log(`Target ready at ${BASE_URL}`);
        return;
      }
    } catch {
      // Server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`target-app did not become healthy within ${STARTUP_TIMEOUT_MS}ms`);
}

function shutdown(): void {
  if (targetProcess && !targetProcess.killed) {
    log('Shutting down target-app...');
    targetProcess.kill('SIGTERM');
  }
}

async function runMonkey(): Promise<void> {
  console.log('🐵 [Orchestrator] Initialization Sequence Triggered.');

  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', shutdown);

  try {
    getCursorApiKey();

    console.log(`[Orchestrator] Loading source file from target app path: ${SERVER_FILE_PATH}`);
    const initialSourceCode = await fs.readFile(SERVER_FILE_PATH, 'utf-8');

    targetProcess = startTargetApp();
    await waitForHealth();

    const attacker = new AttackerAgent(BASE_URL, TARGET_DIR);
    const remediator = new RemediationAgent(TARGET_DIR);

    console.log('\n🔥 [Orchestrator] Phase 1: Initializing Attacker Cyber Threat Simulation Loop...');
    const attackReport = await attacker.runAttackLoop(initialSourceCode);

    if (attackReport.exploitProofStatus === 'SUCCESS') {
      console.log('\n🛠️ [Orchestrator] Phase 2: Exploit Confirmed. Triggering Remediation Subagent...');

      const technicalStateCode = await fs.readFile(SERVER_FILE_PATH, 'utf-8');
      await remediator.runRemediationLoop(attackReport, technicalStateCode);
    } else {
      console.log('\n🛡️ [Orchestrator] Attacker agent failed to bypass endpoint verification rules. System secure.');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ [Orchestrator Fault Summary]:', message);
  } finally {
    console.log('\n🛑 [Orchestrator] Shutdown routine active. Killing sandboxed server instances...');
    shutdown();
    process.exit(0);
  }
}

runMonkey().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[orchestrator] Fatal: ${message}`);
  shutdown();
  process.exit(1);
});
