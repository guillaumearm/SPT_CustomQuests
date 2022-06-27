import type { IQuest } from "@spt-aki/models/eft/common/tables/IQuest";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";

import {
  CustomQuest,
  StoryAcceptedItemGroup,
  StoryItemBuild,
} from "./customQuests";
import {
  CustomQuestsTransformer,
  GeneratedLocales,
} from "./CustomQuestsTransformer";
import { indexBy } from "./utils";

export class QuestsGenerator {
  // indexed by build id
  private builds: Record<string, StoryItemBuild>;

  // indexed by group id
  private groups: Record<string, StoryAcceptedItemGroup>;

  constructor(
    private quests: CustomQuest[],
    itemBuilds: StoryItemBuild[],
    itemGroups: StoryAcceptedItemGroup[],
    private db: DatabaseServer,
    private logger: ILogger
  ) {
    this.builds = indexBy("id", itemBuilds);
    this.groups = indexBy("id", itemGroups);
  }

  private static assertValidCustomQuest(
    customQuest: CustomQuest
  ): asserts customQuest is CustomQuest {
    if (typeof customQuest.id !== "string") {
      throw new Error(`=> Custom Quests: invalid quest, no id found`);
    }
    if (customQuest.id == "") {
      throw new Error(`=> Custom Quests: invalid quest, empty id found`);
    }
    if (typeof customQuest.trader_id !== "string") {
      throw new Error(
        `=> Custom Quests: invalid quest '${customQuest.id}', no trader_id found`
      );
    }
    if (customQuest.trader_id === "ragfair") {
      throw new Error(
        `=> Custom Quests: invalid quest '${customQuest.id}', ragfair cannot be used for quests!`
      );
    }
  }

  generateWithLocales(): (readonly [IQuest, GeneratedLocales])[] {
    const result: (readonly [IQuest, GeneratedLocales])[] = [];

    this.quests.forEach((customQuest) => {
      if (customQuest.disabled) {
        this.logger.warning(
          `=> Custom Quests: quest '${customQuest.id}' is disabled`
        );
      } else {
        QuestsGenerator.assertValidCustomQuest(customQuest);
        const transformer = new CustomQuestsTransformer(
          customQuest,
          this.builds,
          this.groups,
          this.db,
          this.logger
        );

        const generatedQuest = transformer.generateQuest();
        const payload = [
          generatedQuest,
          transformer.generateLocales(generatedQuest),
        ] as const;
        result.push(payload);
      }
    });

    return result;
  }
}
