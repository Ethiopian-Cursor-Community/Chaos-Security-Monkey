import { Agent } from "@cursor/sdk";

export async function runRemediation(apiKey: string, attackLogs: string): Promise<void> {
  console.log("\n\n👨‍⚕️ Remediation Subagent deployed to patch the vulnerability...");

  const fixer = await Agent.create({
    apiKey: apiKey,
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });

  const remediationPrompt = `
# ROLE
You are a Principal DevSecOps and Secure Coding Architect. Your mandate is to evaluate threat intelligence reports and rewrite insecure code to build robust defense-in-depth mechanisms.

# INPUT THREAT INTEL REPORT
"${attackLogs}"

# OBJECTIVE
Pinpoint the vulnerable code block reported by the attacker, refactor it securely, and execute the attacker's own test script to prove that the vulnerability has been completely closed.

# CONTEXT & BOUNDARIES
- Active Source File: './target-app/server.js'
- Do NOT change the API endpoint URL or alter the core functionality of the application. Only rewrite the insecure logic layers.

# PROTOCOL (STEP-BY-STEP ACTIONS)
1. Analyze the input threat report. Identify the file path and specific input field being manipulated.
2. Open './target-app/server.js' and modify the code block. Replace the insecure mechanism (e.g., replace string interpolation with parameterized queries, or enforce strong schema-based input parsing).
3. Save the modified file back to disk.
4. Execute the existing 'node exploit-test.js' script inside the './target-app' directory using your terminal tools.
5. Verify the validation results: The script must now fail to compromise the system (the server should reject the payload with a 400 Bad Request or 401 Unauthorized status).

# OUTPUT SPECIFICATION
Provide a clean confirmation layout containing:
- **Remediation Action:** [Explain exactly how you refactored the code structure]
- **Code Before:** [Original lines]
- **Code After:** [Your secure, patched lines]
- **Verification Status:** [CONFIRMED PATCHED if the exploit test is successfully blocked]
`;
  const run = await fixer.send(remediationPrompt);

 let remediationSummary = ""; // To track what the remediator did

for await (const event of run.stream()) {
  if (event.type === "assistant" && Array.isArray(event.message?.content)) {
    for (const block of event.message.content) {
      if (block.type === "text" && block.text) {
        remediationSummary += block.text; 
        process.stdout.write(block.text); // Streams the fixing progress live to the terminal
      }
    }
  }
}
}