import type { IQuest } from "@spt-aki/models/eft/common/tables/IQuest";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";

import { ALL_VANILLA_QUESTS } from "./allVanillaQuestIds";
import type { Config, ConfigAtStart } from "./config";

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
    const jaeger = this.db.getTables().traders[JAEGER_ID];

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

        // 2. wipe backend counters
        if (!pmcData.BackendCounters) {
          pmcData.BackendCounters = {};
        }

        let backendCounterRemoved = false;
        const backendCounters = pmcData.BackendCounters;
        Object.keys(backendCounters).forEach((counterId) => {
          const counter = backendCounters[counterId];

          if (counter && counter.qid === questId) {
            backendCounterRemoved = true;
            if (pmcData.BackendCounters) {
              delete pmcData.BackendCounters[counterId];
            }
          }
        });

        // 3. wipe condition counters
        const Counters =
          pmcData.ConditionCounters?.Counters.filter(
            (payload) => payload.qid !== questId
          ) ?? [];
        const counterRemoved =
          Counters.length !== pmcData.ConditionCounters?.Counters.length ?? 0;

        if (pmcData.ConditionCounters) {
          pmcData.ConditionCounters.Counters = Counters;
        }

        // 4. wipe DroppedItems
        let droppedItem = false;
        if (
          pmcData.Stats &&
          pmcData.Stats.DroppedItems &&
          pmcData.Stats.DroppedItems.length > 0
        ) {
          const DroppedItems = pmcData.Stats.DroppedItems.filter(
            (payload) => payload.QuestId !== questId
          );

          if (DroppedItems.length !== pmcData.Stats.DroppedItems.length) {
            droppedItem = true;
          }

          pmcData.Stats.DroppedItems = DroppedItems;
        }

        if (
          questRemoved ||
          backendCounterRemoved ||
          counterRemoved ||
          droppedItem
        ) {
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

  afterCustomQuestsLoaded(loadedQuests: IQuest[]): void {
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
