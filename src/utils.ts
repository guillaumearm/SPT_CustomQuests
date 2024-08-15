import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import crypto from "crypto";
import { readFileSync } from "fs";
import type { PackageJson } from "./config";

export const getSHA256 = (input: string): string => {
  return crypto.createHash("sha256").update(input).digest("hex");
};

export const readJsonFile = <T>(path: string): T => {
  return JSON.parse(readFileSync(path, "utf-8"));
};

export const getAllLocales = (db: DatabaseServer): string[] => {
  const locales = db.getTables().locales;

  if (!locales) {
    throw new Error("no locales found in db");
  }

  return Object.keys(locales.global);
};

export const isNotUndefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};

export const isNotNil = <T>(value: T | undefined | null): value is T => {
  return value !== undefined && value !== null;
};

export const getModDisplayName = (
  packageJson: PackageJson,
  withVersion = false
): string => {
  if (withVersion) {
    return `${packageJson.displayName} v${packageJson.version}`;
  }
  return `${packageJson.displayName}`;
};

export function noop(): void {}

export function indexBy<S extends keyof T, T extends Record<S, string>>(
  key: S,
  elements: T[]
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const element of elements) {
    result[element[key]] = element;
  }

  return result;
}

export function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}
