import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

/**
 * Returns true if the current module is the one executed by Node.js.
 * Useful for providing "demo" code in DSA files that shouldn't run
 * when the file is imported by Jest tests.
 */
export const isMain = (importMetaUrl: string): boolean => {
  try {
    const modulePath = fileURLToPath(importMetaUrl);
    const scriptPath = realpathSync(process.argv[1]!);
    return modulePath === scriptPath;
  } catch {
    return false;
  }
};
