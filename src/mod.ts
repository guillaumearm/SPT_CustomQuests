"use strict";

import type { IMod } from "@spt-aki/models/external/mod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { VFS } from "@spt-aki/utils/VFS";

import { DependencyContainer } from "tsyringe";

import {
  Config,
  CONFIG_PATH,
  getQuestsDirectory,
  PackageJson,
  PACKAGE_JSON_PATH,
} from "./config";
import { OnStartHandler } from "./OnStartHandler";
import { QuestsLoader } from "./QuestsLoader";
import { getModDisplayName, noop, readJsonFile } from "./utils";

class CustomQuests implements IMod {
  private packageJson: PackageJson;
  private config: Config;
  private questDirectory: string;

  private logger: ILogger;
  private debug: (data: string) => void;

  load(container: DependencyContainer): void {
    this.packageJson = readJsonFile<PackageJson>(PACKAGE_JSON_PATH);
    this.config = readJsonFile<Config>(CONFIG_PATH);
    this.logger = container.resolve<ILogger>("WinstonLogger");

    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Custom Quests: ${data}`, true)
      : noop;

    this.questDirectory = getQuestsDirectory(this.config);

    if (!this.config.enabled) {
      this.logger.warning(`=> Custom Quests: disabled from the config file`);
      return;
    }

    this.logger.info(`===> Loading Custom Quests v${this.packageJson.version}`);
  }

  delayedLoad(container: DependencyContainer): void {
    if (!this.config.enabled) {
      return;
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const saveServer = container.resolve<SaveServer>("SaveServer");
    const vfs = container.resolve<VFS>("VFS");

    const onStart = new OnStartHandler(
      db,
      saveServer,
      this.logger,
      this.config
    );

    onStart.beforeCustomQuestsLoaded();

    const questsLoader = new QuestsLoader(
      this.questDirectory,
      db,
      vfs,
      this.logger,
      this.debug
    );
    const loadedQuests = questsLoader.loadAll();

    onStart.afterCustomQuestsLoaded(loadedQuests);

    this.logger.success(
      `=> Custom Quests: ${loadedQuests.length} quests loaded`
    );

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`
    );
  }
}

module.exports = { mod: new CustomQuests() };
