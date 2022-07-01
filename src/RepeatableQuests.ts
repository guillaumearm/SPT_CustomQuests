import { GameCallbacks } from "@spt-aki/callbacks/GameCallbacks";
import { Quest } from "@spt-aki/models/eft/common/IPmcData";
import { SaveServer } from "@spt-aki/servers/SaveServer";
import { DependencyContainer } from "tsyringe";

export const resetRepeatableQuestsOnGameStart = (
  container: DependencyContainer,
  saveServer: SaveServer,
  // Warning: not the same goal as `isRepeatedQuest` function
  getRepeatableQuestIds: () => Record<string, boolean>
): void => {
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
        const response = gameStart(url, info, sessionId);

        const profile = saveServer.getProfile(sessionId);
        const pmc = profile.characters.pmc;

        // 1. filter all success repeatable quests
        pmc.Quests = pmc.Quests.filter((q) => !isSuccessRepeatableQuest(q));

        pmc.Quests.forEach((q) => {
          const originalQuestId = extractOriginalQuestId(q.qid);
          // if it's a repeated quest
          if (originalQuestId !== null) {
            if (q.status === "Started" || q.status === "AvailableForStart") {
              // replace the quest id by the original quest id
              q.qid = originalQuestId;
            }
          }
        });

        return response;
      };
    }
  );
};

const REPEATED_QUEST_PREFIX = "@repeated";

export const createRepeatedQuestId = (questId: string, index: number): string =>
  `${REPEATED_QUEST_PREFIX}/${questId}/${index}`;

/**
 * Warning: a repeated quest is not repeatable quest
 *
 * repeated quest = with REPEATED_QUEST_PREFIX prefix
 * repeatable quest = original quest + repeated quests included
 */
export const isRepeatedQuest = (questId: string): boolean => {
  return questId.startsWith(REPEATED_QUEST_PREFIX);
};

export const extractOriginalQuestId = (questId: string): string | null => {
  if (!isRepeatedQuest(questId)) {
    return null;
  }

  const splitted = questId.split("/");

  if (splitted.length < 3) {
    return null;
  }

  return splitted.slice(0, -1).slice(1).join("/");
};
