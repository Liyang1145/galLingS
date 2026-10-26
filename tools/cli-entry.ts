import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Compare the actual files, including Windows profile junctions and symlinked entry paths. */
export function isCommandEntry(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
