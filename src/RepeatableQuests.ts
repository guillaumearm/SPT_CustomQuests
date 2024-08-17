import type { GameCallbacks } from "@spt/callbacks/GameCallbacks";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { DependencyContainer } from "tsyringe";
import { isNotNil } from "./utils";

const SUCCESS = 4;
const STARTED = 2;
const AVAILABLE_FOR_START = 1;

const isSuccess = (status: any): boolean =>
  status === SUCCESS || status === "Success";

const isStarted = (status: any): boolean =>
  status === STARTED || status === "Started";

const isAvailableForStart = (status: any): boolean =>
  status === AVAILABLE_FOR_START || status === "AvailableForStart";

const filterInObject = <T>(
  predicate: (x: T, idx: number) => boolean,
  xs: Record<string, T>
): Record<string, T> => {
  const result: Record<string, T> = {};

  Object.keys(xs).forEach((id, idx) => {
    const x = xs[id];

    if (predicate(x, idx)) {
      result[id] = x;
    }
  });

  return result;
};

const getConditionsIdsMappingFromTemplate = (
  sourceQuestId: string,
  destQuestId: string,
  db: DatabaseServer
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const quests = db.getTables().templates?.quests;

  if (!quests) {
    throw new Error("Cannot load quests templates from db");
  }

  const sourceQuest = quests[sourceQuestId];
  const destQuest = quests[destQuestId];

  if (!sourceQuest || !destQuest) {
    return {};
  }

  const sourceStartConditions = sourceQuest.conditions.AvailableForStart ?? [];
  const sourceFinishConditions =
    sourceQuest.conditions.AvailableForFinish ?? [];
  const sourceFailConditions = sourceQuest.conditions.Fail ?? [];

  const destStartConditions = destQuest.conditions.AvailableForStart ?? [];
  const destFinishConditions = destQuest.conditions.AvailableForFinish ?? [];
  const destFailConditions = destQuest.conditions.Fail ?? [];

  sourceStartConditions.forEach((condition, idx) => {
    if (destStartConditions[idx]) {
      mapping[condition.id] = destStartConditions[idx].id;
    }
  });

  sourceFinishConditions.forEach((condition, idx) => {
    if (destFinishConditions[idx]) {
      mapping[condition.id] = destFinishConditions[idx].id;
    }
  });

  sourceFailConditions.forEach((condition, idx) => {
    if (destFailConditions[idx]) {
      mapping[condition.id] = destFailConditions[idx].id;
    }
  });

  return mapping;
};

export const resetRepeatableQuestsOnGameStart = (
  container: DependencyContainer,
  saveServer: SaveServer,
  debug: (data: string) => void,
  db: DatabaseServer
): void => {
  container.afterResolution<GameCallbacks>(
    "GameCallbacks",
    (_t, controllers) => {
      const controller = Array.isArray(controllers)
        ? controllers[0]
        : controllers;

      const gameStart = controller.gameStart.bind(controller);

      controller.gameStart = (url, info, sessionId) => {
        debug("game started!");
        const profile = saveServer.getProfile(sessionId);
        const pmc = profile.characters.pmc;

        let replacedCounters = 0;
        let changedQuestsStatus = 0;
        let removedCounters = 0;
        let removedRepeatedQuests = 0;

        if (!pmc || !pmc.Quests) {
          // avoid crash on first game start (fresh profile)
          pmc.Quests = [];
        }

        // 0. reset all counters to 0 for a repeatable quest
        // first, index the original repeated quest ids
        const originalRepeatableQuests: Record<string, boolean> = {};

        pmc.Quests.map((q) => extractOriginalQuestId(q.qid))
          .filter(isNotNil)
          .forEach((id) => {
            originalRepeatableQuests[id] = true;
          });

        // then, reset all Success repeatable quest
        // repeatable quest =  original repeatable quest OR repeated quest
        pmc.Quests.forEach((q) => {
          if (
            isSuccess(q.status) &&
            (originalRepeatableQuests[q.qid] || isRepeatedQuest(q.qid))
          ) {
            Object.values(pmc.TaskConditionCounters ?? {}).forEach(
              (counter) => {
                if (counter.sourceId === q.qid) {
                  counter.value = 0;
                }
              }
            );
          }
        });

        // 1. replace counters
        pmc.Quests.forEach((q) => {
          if (
            isRepeatedQuest(q.qid) &&
            (isStarted(q.status) || isAvailableForStart(q.status))
          ) {
            const originalId = extractOriginalQuestId(q.qid);
            if (originalId) {
              const conditionsMapping = getConditionsIdsMappingFromTemplate(
                originalId,
                q.qid,
                db
              );

              Object.values(pmc.TaskConditionCounters ?? {})
                .filter((counter) => counter.sourceId === originalId)
                .forEach((counter) => {
                  const otherCounterId = conditionsMapping[counter.id];
                  const backendCounters = pmc.TaskConditionCounters ?? {};

                  if (backendCounters[otherCounterId]) {
                    const otherCounter = backendCounters[otherCounterId];
                    counter.value = otherCounter?.value ?? 0;
                    replacedCounters = replacedCounters + 1;
                  }
                });
            }
          }
        });

        // 2. change quests status
        pmc.Quests.filter(
          (q) =>
            isRepeatedQuest(q.qid) &&
            (isStarted(q.status) || isAvailableForStart(q.status))
        ).forEach((repeatedQuest) => {
          const originalId = extractOriginalQuestId(repeatedQuest.qid);

          if (originalId) {
            pmc.Quests = pmc.Quests.map((q) => {
              if (q.qid === originalId) {
                changedQuestsStatus = changedQuestsStatus + 1;
                return { ...repeatedQuest, qid: originalId };
              }
              return q;
            });
          }
        });

        // 3. remove all counters related to @repeated quests
        pmc.TaskConditionCounters = filterInObject((counter) => {
          if (isRepeatedQuest(counter.sourceId ?? "")) {
            removedCounters = removedCounters + 1;
            return false;
          }
          return true;
        }, pmc.TaskConditionCounters ?? {});

        // 4. remove all repeated quests
        pmc.Quests = pmc.Quests.filter((q) => {
          if (isRepeatedQuest(q.qid)) {
            removedRepeatedQuests = removedRepeatedQuests + 1;
            return false;
          }
          return true;
        });

        if (replacedCounters) {
          debug(`${replacedCounters} counter(s) replaced`);
        }
        if (changedQuestsStatus) {
          debug(`${changedQuestsStatus} repeatable quest(s) status changed`);
        }
        if (removedCounters) {
          debug(`${removedCounters} counter(s) removed`);
        }
        if (removedRepeatedQuests) {
          debug(`${removedRepeatedQuests} repeated quest(s) removed`);
        }

        return gameStart(url, info, sessionId);
      };
    },
    { frequency: "Always" }
  );
};

const REPEATED_QUEST_PREFIX = "@repeated";
const REPEATED_QUEST_SUFFIX = "@";

export const createRepeatedQuestId = (questId: string, index: number): string =>
  `${REPEATED_QUEST_PREFIX}/${questId}/${index}${REPEATED_QUEST_SUFFIX}`;

/**
 * Warning: a repeated quest is not repeatable quest
 *
 * repeated quest = with REPEATED_QUEST_* prefix and suffix
 * repeatable quest = original quest + repeated quests included
 */
const isRepeatedQuest = (questId: string): boolean => {
  return questId.startsWith(REPEATED_QUEST_PREFIX);
};

const extractOriginalQuestId = (questId: string): string | null => {
  if (!isRepeatedQuest(questId)) {
    return null;
  }

  const splitted = questId.split("/");

  if (splitted.length < 3) {
    return null;
  }

  return splitted.slice(0, -1).slice(1).join("/");
};
