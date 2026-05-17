import { runAttacker } from "./src/attackerAgent.js";
import { runRemediation } from "./src/remediationAgent.js";
import { exec, ChildProcess } from "child_process";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess: ChildProcess;

function startTargetServer() {
  console.log("🟢 Step 1: Booting up target application server sandbox...");
  const targetPath = path.join(__dirname, "target-app");
  
  serverProcess = exec("node server.js", { cwd: targetPath });
  
  serverProcess.stdout?.on("data", (data) => console.log(`[Target Server]: ${data.trim()}`));
  serverProcess.stderr?.on("data", (data) => console.error(`[Target Error]: ${data.trim()}`));
}

async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("Missing CURSOR_API_KEY environment variable.");
    process.exit(1);
  }

  // Start the vulnerable target server
  startTargetServer();
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for server to bind to port 5000

  try {
    // Phase 1: Trigger the Attacker Agent file
    console.log("\n🚀 Phase 1: Launching Cyber Threat Simulation...");
    const attackReport = await runAttacker(apiKey);

    // Phase 2: Feed the attacker results directly to the Remediation Agent file
    console.log("\n🚀 Phase 2: Launching Self-Healing Remediation Loop...");
    await runRemediation(apiKey, attackReport);

    console.log("\n🎉 Operation Chaos Security Monkey finished flawlessly!");
  } catch (error) {
    console.error("An error occurred during execution loop:", error);
  } finally {
    // Shutdown the target app sandbox safely
    console.log("🛑 Cleaning up workspace. Shutting down target server.");
    if (serverProcess) serverProcess.kill();
  }
}

main();