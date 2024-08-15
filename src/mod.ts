"use strict";

import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { VFS } from "@spt/utils/VFS";

import type { DependencyContainer } from "tsyringe";

import type { Config, PackageJson } from "./config";
import { PACKAGE_JSON_PATH, getQuestsDirectory, CONFIG_PATH } from "./config";

import type { StoryItem } from "./customQuests";
import { OnStartHandler } from "./OnStartHandler";
import { QuestsLoader } from "./QuestsLoader";
import { resetRepeatableQuestsOnGameStart } from "./RepeatableQuests";
import { getModDisplayName, noop, readJsonFile } from "./utils";
import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";

type CustomQuestsAPI = {
  load: (quests: StoryItem[]) => void;
};

const setCustomQuestsAPI = (api: CustomQuestsAPI): string => {
  const apiName = "CustomQuestsAPI";

  (globalThis as any)[apiName] = api;

  return apiName;
};

class CustomQuests implements IPreSptLoadMod, IPostSptLoadMod {
  private packageJson: PackageJson;
  private config: Config;
  private questDirectory: string;

  private questsLoader: QuestsLoader | null = null; // used by api
  private pendingItems: StoryItem[] = []; // used by api

  private logger: ILogger;
  private debug: (data: string) => void;

  preSptLoad(container: DependencyContainer): void {
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

    const api: CustomQuestsAPI = {
      load: (story: StoryItem[]) => {
        if (this.questsLoader) {
          const quests = this.questsLoader.injectStory(story);

          this.logger.success(
            `=> Custom Quests API: ${quests.length} quests loaded`
          );
        } else {
          this.pendingItems = [...this.pendingItems, ...story];
        }
      },
    };

    this.logger.info(`===> Loading Custom Quests v${this.packageJson.version}`);

    const apiName = setCustomQuestsAPI(api);
    this.debug(`api exposed under 'globalThis.${apiName}'`);
  }

  postSptLoad(container: DependencyContainer): void {
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

    this.questsLoader = new QuestsLoader(
      this.questDirectory,
      db,
      vfs,
      this.config,
      this.logger,
      this.debug
    );

    resetRepeatableQuestsOnGameStart(container, saveServer, this.debug, db);

    const loadedQuests = this.questsLoader.loadAll();
    const apiQuests = this.questsLoader.injectStory(this.pendingItems);
    this.pendingItems = [];

    onStart.afterCustomQuestsLoaded(loadedQuests);

    this.logger.success(
      `=> Custom Quests: ${loadedQuests.length} quest${
        loadedQuests.length > 1 ? "s" : ""
      } loaded`
    );

    if (apiQuests.length) {
      this.logger.success(
        `=> Custom Quests API: ${apiQuests.length} quest${
          apiQuests.length > 1 ? "s" : ""
        } loaded`
      );
    }

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`
    );
  }
}

module.exports = { mod: new CustomQuests() };
