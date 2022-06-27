import { resolve } from "path";

/**
 * package.json
 */
export type PackageJson = {
  name: string;
  displayName: string;
  version: string;
};

export type ConfigAtStart = {
  disable_all_vanilla_quests?: boolean;
  wipe_enabled_custom_quests_state_from_all_profiles?: boolean;
};

/**
 * config/config.json
 */
export type Config = {
  enabled?: boolean;
  debug?: boolean;
  quest_directory?: string;
  at_start?: ConfigAtStart;
};

export const PACKAGE_JSON_PATH = resolve(__dirname, "..", "package.json");
export const CONFIG_PATH = resolve(__dirname, "..", "config/config.json");

export const DEFAULT_QUESTS_DIR = "quests";

export const getQuestsDirectory = (config: Config): string => {
  return resolve(__dirname, "..", config.quest_directory || DEFAULT_QUESTS_DIR);
};
