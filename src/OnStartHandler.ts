import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";

import { ALL_VANILLA_QUESTS } from "./allVanillaQuestIds";
import type { Config, ConfigAtStart } from "./config";
import type { Quest } from "./CustomQuestsTransformer";

const JAEGER_ID = "5c0647fdd443bc2504c2d371";

export class OnStartHandler {
  private onStartConfig: ConfigAtStart;

  constructor(
    private db: DatabaseServer,
    private saveServer: SaveServer,
    private logger: ILogger,
    config: Config
  ) {
    this.onStartConfig = config.at_start || {};
  }

  private disableVanillaQuests(): void {
    const nbQuests = ALL_VANILLA_QUESTS.length;
    const templates = this.db.getTables().templates;

    if (templates) {
      ALL_VANILLA_QUESTS.forEach((questId) => {
        delete templates.quests[questId];
      });

      this.logger.info(`=> Custom Quests: ${nbQuests} vanilla quests removed`);
    }
  }

  private unlockJaegger(): void {
    const traders = this.db.getTables().traders;

    if (!traders) {
      throw new Error("no traders found in db");
    }

    const jaeger = traders[JAEGER_ID];

    jaeger.base.unlockedByDefault = true;
    this.logger.info(`=> Custom Quests: Jaeger trader unlocked by default`);
  }

  private wipeProfilesForQuest(questId: string): void {
    let nbWiped = 0;
    const profileIds = Object.keys(this.saveServer.getProfiles());

    profileIds.forEach((profileId) => {
      const profile = this.saveServer.getProfile(profileId);
      const pmcData = profile && profile.characters && profile.characters.pmc;
      const dialogues = profile.dialogues || {};

      if (pmcData && pmcData.Quests) {
        // 1. wipe quests
        const Quests = pmcData.Quests.filter((q) => q.qid !== questId);
        const questRemoved = Quests.length !== pmcData.Quests.length;

        pmcData.Quests = Quests;

        // TODO
        // 2. wipe backend counters
        if (!pmcData.TaskConditionCounters) {
          pmcData.TaskConditionCounters = {};
        }

        let backendCounterRemoved = false;
        const taskConditionCounters = pmcData.TaskConditionCounters;
        Object.keys(taskConditionCounters).forEach((counterId) => {
          const counter = taskConditionCounters[counterId];

          if (counter && counter.sourceId === questId) {
            backendCounterRemoved = true;
            if (pmcData.TaskConditionCounters) {
              delete pmcData.TaskConditionCounters[counterId];
            }
          }
        });

        // TODO
        // 4. wipe DroppedItems
        let droppedItem = false;
        if (
          pmcData.Stats.Eft &&
          pmcData.Stats.Eft.DroppedItems &&
          pmcData.Stats.Eft.DroppedItems.length > 0
        ) {
          const DroppedItems = pmcData.Stats.Eft.DroppedItems.filter(
            (payload) => payload.QuestId !== questId
          );

          if (DroppedItems.length !== pmcData.Stats.Eft.DroppedItems.length) {
            droppedItem = true;
          }

          pmcData.Stats.Eft.DroppedItems = DroppedItems;
        }

        if (questRemoved || backendCounterRemoved || droppedItem) {
          nbWiped += 1;
        }
      }

      // 5. wipe dialogues
      Object.keys(dialogues).forEach((dialogId) => {
        const dialogue = dialogues[dialogId] || {};
        const messages = dialogue.messages || [];
        dialogue.messages = messages.filter(
          (msg) =>
            msg.templateId !== `${questId}_description` &&
            msg.templateId !== `${questId}_success_message_text`
        );
      });
    });

    if (nbWiped > 0) {
      this.logger.info(
        `=> Custom Quests: wiped ${nbWiped} profile${
          nbWiped > 1 ? "s" : ""
        } for quest '${questId}'`
      );
    }
  }

  beforeCustomQuestsLoaded(): void {
    if (this.onStartConfig.disable_all_vanilla_quests) {
      this.disableVanillaQuests();
      this.unlockJaegger();
    }
  }

  afterCustomQuestsLoaded(loadedQuests: Quest[]): void {
    if (
      !this.onStartConfig.wipe_enabled_custom_quests_state_from_all_profiles
    ) {
      return;
    }

    this.saveServer.load();

    loadedQuests.forEach((quest) => {
      this.wipeProfilesForQuest(quest._id);
    });

    this.saveServer.save();
  }
}
