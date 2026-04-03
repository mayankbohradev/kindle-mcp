import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const CONFIG_DIR = join(homedir(), ".kindle-mcp");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface LocalConfig {
  notion_database_id?: string;
}

function readConfig(): LocalConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as LocalConfig;
  } catch {
    return {};
  }
}

function writeConfig(config: LocalConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getLocalDatabaseId(): string | undefined {
  return readConfig().notion_database_id;
}

export function saveLocalDatabaseId(id: string): void {
  const config = readConfig();
  config.notion_database_id = id;
  writeConfig(config);
}
