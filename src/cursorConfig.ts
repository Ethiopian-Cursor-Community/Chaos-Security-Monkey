/**
 * Loads CURSOR_API_KEY from environment (.env via --env-file in npm scripts).
 * Used by attack/remediation agents (Teammates 2 & 3).
 */
export function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error(
      'CURSOR_API_KEY is not set. Copy .env.example to .env and add your key from Cursor settings.',
    );
  }
  return key;
}
