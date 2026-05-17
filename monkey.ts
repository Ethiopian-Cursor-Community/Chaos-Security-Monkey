import { spawn, exec, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { AttackerAgent } from './src/attackerAgent.js';
import { RemediationAgent } from './src/remediationAgent.js';
import fs from 'node:fs';

dotenv.config();

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.join(ROOT, 'target-app');
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

async function main(): Promise<void> {
  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', shutdown);

  targetProcess = startTargetApp();
  await waitForHealth();

  log('Sandbox is up. API base: ' + BASE_URL);

  const apiKey = process.env.CURSOR_API_KEY || 'crsr_1606d9fc86ee6b9393e1f13da35945fd35bc8b4e4a5302b999c06bccab946498';

  try {
    const targetJsPath = path.join(TARGET_DIR, 'server.js');
    const targetSourceCode = fs.readFileSync(targetJsPath, 'utf-8');

    // Phase 1: Trigger the Attacker Agent
    console.log("\n🚀 Phase 1: Launching Cyber Threat Simulation...");
    const attacker = new AttackerAgent(BASE_URL, TARGET_DIR);
    const attackReport = await attacker.runAttackLoop(targetSourceCode);

    // Phase 2: Feed the attacker results directly to the Remediation Agent
    console.log("\n🚀 Phase 2: Launching Self-Healing Remediation Loop...");
    const remediator = new RemediationAgent(apiKey);
    await remediator.formulateAndApplyPatch(targetJsPath, JSON.stringify(attackReport));

    console.log("\n🎉 Operation Chaos Security Monkey finished flawlessly!");
  } catch (error: any) {
    console.error("An error occurred during execution loop:", error);
  } finally {
    shutdown();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[orchestrator] Fatal: ${message}`);
  shutdown();
  process.exit(1);
});
