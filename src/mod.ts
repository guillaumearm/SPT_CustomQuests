"use strict";

import { GameCallbacks } from "@spt-aki/callbacks/GameCallbacks";
import { Quest } from "@spt-aki/models/eft/common/IPmcData";
import type { IMod } from "@spt-aki/models/external/mod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
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
import { StoryItem } from "./customQuests";
import { OnStartHandler } from "./OnStartHandler";
import { QuestsLoader } from "./QuestsLoader";
import { getModDisplayName, noop, readJsonFile } from "./utils";

type CustomQuestsAPI = {
  load: (quests: StoryItem[]) => void;
};

const setCustomQuestsAPI = (api: CustomQuestsAPI): string => {
  const apiName = "CustomQuestsAPI";

  (globalThis as any)[apiName] = api;

  return apiName;
};

const eraseRepeatableQuestsOnGameStart = (
  container: DependencyContainer,
  saveServer: SaveServer,
  getRepeatableQuestIds: () => Record<string, boolean>
) => {
  const isSuccessRepeatableQuest = (q: Quest): boolean => {
    return getRepeatableQuestIds()[q.qid] && q.status === "Success";
  };

  container.afterResolution<GameCallbacks>(
    "GameCallbacks",
    (_t, controllers) => {
      const controller = Array.isArray(controllers)
        ? controllers[0]
        : controllers;

      const gameStart = controller.gameStart.bind(controller);

      controller.gameStart = (url, info, sessionId) => {
        console.log(`=> game started for profile '${sessionId}'`);
        const response = gameStart(url, info, sessionId);

        const profile = saveServer.getProfile(sessionId);
        const pmc = profile.characters.pmc;

        pmc.Quests = pmc.Quests.filter((q) => !isSuccessRepeatableQuest(q));

        return response;
      };
    }
  );
};

class CustomQuests implements IMod {
  private packageJson: PackageJson;
  private config: Config;
  private questDirectory: string;

  private questsLoader: QuestsLoader | null = null; // used by api
  private pendingItems: StoryItem[] = []; // used by api

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

    this.questsLoader = new QuestsLoader(
      this.questDirectory,
      db,
      vfs,
      this.config,
      this.logger,
      this.debug
    );

    eraseRepeatableQuestsOnGameStart(
      container,
      saveServer,
      this.questsLoader.getRepeatableQuestIds.bind(this.questsLoader)
    );

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
