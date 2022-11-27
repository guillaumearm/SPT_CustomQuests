import { resolve } from "path";

/**
 * Default values
 */
const DEFAULT_LIMIT_REPEATED_QUEST = 10;

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
  default_quest_name_prefix?: string;
  limit_repeated_quest?: number;
  at_start?: ConfigAtStart;
};

export const PACKAGE_JSON_PATH = resolve(__dirname, "..", "package.json");
export const CONFIG_PATH = resolve(__dirname, "..", "config/config.json");

export const DEFAULT_QUESTS_DIR = "quests";

export const getQuestsDirectory = (config: Config): string => {
  return resolve(__dirname, "..", config.quest_directory || DEFAULT_QUESTS_DIR);
};

export const getLimitRepeatedQuest = (config: Config): number => {
  return config.limit_repeated_quest ?? DEFAULT_LIMIT_REPEATED_QUEST;
};
