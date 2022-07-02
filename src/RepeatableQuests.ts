import type { GameCallbacks } from "@spt-aki/callbacks/GameCallbacks";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { DependencyContainer } from "tsyringe";

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
  const quests = db.getTables().templates.quests;

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
      mapping[condition._props.id] = destStartConditions[idx]._props.id;
    }
  });

  sourceFinishConditions.forEach((condition, idx) => {
    if (destFinishConditions[idx]) {
      mapping[condition._props.id] = destFinishConditions[idx]._props.id;
    }
  });

  sourceFailConditions.forEach((condition, idx) => {
    if (destFailConditions[idx]) {
      mapping[condition._props.id] = destFailConditions[idx]._props.id;
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
        const response = gameStart(url, info, sessionId);

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

        // 1. replace counters
        pmc.Quests.forEach((q) => {
          if (
            isRepeatedQuest(q.qid) &&
            (q.status === "Started" || q.status === "AvailableForStart")
          ) {
            const originalId = extractOriginalQuestId(q.qid);
            if (originalId) {
              const conditionsMapping = getConditionsIdsMappingFromTemplate(
                originalId,
                q.qid,
                db
              );

              // backend counters
              Object.values(pmc.BackendCounters)
                .filter((counter) => counter.qid === originalId)
                .forEach((counter) => {
                  const otherCounterId = conditionsMapping[counter.id];
                  if (pmc.BackendCounters[otherCounterId]) {
                    const otherCounter = pmc.BackendCounters[otherCounterId];
                    counter.value = otherCounter?.value ?? 0;
                    replacedCounters = replacedCounters + 1;
                  }
                });

              // condition counters
              pmc.ConditionCounters.Counters.filter(
                (counter) => counter.qid === originalId
              ).forEach((counter) => {
                const otherCounterId = conditionsMapping[counter.id];
                const otherCounter = pmc.ConditionCounters.Counters.find(
                  (c) => c.id === otherCounterId
                );
                if (otherCounter) {
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
            (q.status === "Started" || q.status === "AvailableForStart")
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
        // backend counters
        pmc.BackendCounters = filterInObject((counter) => {
          if (isRepeatedQuest(counter.qid ?? "")) {
            removedCounters = removedCounters + 1;
            return false;
          }
          return true;
        }, pmc.BackendCounters);

        // condition counters
        pmc.ConditionCounters.Counters = pmc.ConditionCounters.Counters.filter(
          (counter) => {
            if (isRepeatedQuest(counter.qid)) {
              removedCounters = removedCounters + 1;
              return false;
            }

            return true;
          }
        );

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
          debug(`${removedCounters} repeated quest(s) removed`);
        }

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
