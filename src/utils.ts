import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import crypto from "crypto";
import { readFileSync } from "fs";

export const getSHA256 = (input: string): string => {
  return crypto.createHash("sha256").update(input).digest("hex");
};

export const readJsonFile = <T>(path: string): T => {
  return JSON.parse(readFileSync(path, "utf-8"));
};

export const getAllLocales = (db: DatabaseServer): string[] =>
  Object.keys(db.getTables().locales.global);

export const isNotUndefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};