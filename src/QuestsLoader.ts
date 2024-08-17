import type { IQuest } from "@spt/models/eft/common/tables/IQuest";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { VFS } from "@spt/utils/VFS";

import { join } from "path";
import type { Config } from "./config";
import { getLimitRepeatedQuest } from "./config";

import type {
  CustomQuest,
  LocaleName,
  StoryAcceptedItemGroup,
  StoryItem,
  StoryItemBuild,
} from "./customQuests";

import {
  isStoryAcceptedItemGroup,
  isStoryCustomQuest,
  isStoryItemBuild,
} from "./customQuests";

import type { GeneratedLocales, Quest } from "./CustomQuestsTransformer";
import { QuestsGenerator } from "./QuestsGenerator";
import { createRepeatedQuestId } from "./RepeatableQuests";
import { flatten, getAllLocales, readJsonFile } from "./utils";

const repeatQuest = (
  originalQuest: CustomQuest,
  limitRepeatedQuest: number
): CustomQuest[] => {
  // This is to avoid a weird BSG bug. pretty sure at some time ids doesn't strict match but a "x contains y" check is made somewhere
  const quest = {
    ...originalQuest,
    id: `#${originalQuest.id}#`,
  };

  let previousId = quest.id;
  const additionalQuests: CustomQuest[] = Array.from(
    Array(Math.abs(limitRepeatedQuest)).keys()
  ).map((index) => {
    const newQuest = { ...quest };

    newQuest.id = createRepeatedQuestId(originalQuest.id, index);
    newQuest.locked_by_quests = [previousId];

    previousId = newQuest.id;
    return newQuest;
  });

  return [quest, ...additionalQuests];
};

export class QuestsLoader {
  constructor(
    private questDirectory: string,
    private db: DatabaseServer,
    private vfs: VFS,
    private config: Config,
    private logger: ILogger,
    private debug: (data: string) => void
  ) {
    this.questDirectory = questDirectory;
  }

  loadAll(): Quest[] {
    let loadedQuests = this.loadDir(this.questDirectory);

    this.vfs.getDirs(this.questDirectory).forEach((subdir) => {
      if (subdir.endsWith(".disabled")) {
        if (subdir !== "examples.disabled") {
          this.logger.warning(
            `=> Custom Quests: skipped '${subdir}' quest directory`
          );
        }
      } else {
        const loadedSubQuests = this.loadDir(join(this.questDirectory, subdir));
        loadedQuests = [...loadedQuests, ...loadedSubQuests];
      }
    });

    return loadedQuests;
  }

  private loadDir(dir: string): Quest[] {
    let loadedQuests: Quest[] = [];

    this.vfs.getFiles(dir).forEach((fileName) => {
      if (fileName.endsWith(".json")) {
        const quests = this.loadFile(fileName, dir);
        loadedQuests = [...loadedQuests, ...quests];
      }
    });

    return loadedQuests;
  }

  private loadQuest(quest: Quest): void {
    const quests = this.db.getTables().templates?.quests;

    if (!quests) {
      throw new Error("quests templates not found in db");
    }

    if (quests[quest._id]) {
      this.logger.error(
        `=> Custom Quests: already registered questId '${quest._id}'`
      );
    } else {
      quests[quest._id] = quest as IQuest;
    }
  }

  private loadLocales(
    questId: string,
    localesPayloads: GeneratedLocales
  ): void {
    const locales = this.db.getTables().locales;

    if (!locales) {
      throw new Error("locales not found in db");
    }

    getAllLocales(this.db).forEach((localeName) => {
      const payload = localesPayloads[localeName as LocaleName];
      const globalLocales = locales.global[localeName];

      if (globalLocales[questId]) {
        this.logger.error(
          `=> Custom Quests: already registered locales for questId '${questId}'`
        );
      } else {
        globalLocales[questId] = payload.quest;
      }

      Object.keys(payload).forEach((localeIdentifier) => {
        if (globalLocales[localeIdentifier]) {
          this.logger.error(
            `=> Custom Quests: already registered locale '${localeIdentifier}' for questId '${questId}'`
          );
        } else {
          globalLocales[localeIdentifier] = payload[localeIdentifier];
        }
      });
    });
  }

  private expandRepeatableQuests(quests: CustomQuest[]): CustomQuest[] {
    const resultQuests: CustomQuest[][] = [];

    const limitRepeatedQuest = getLimitRepeatedQuest(this.config);

    quests.forEach((q) => {
      if (q.repeatable) {
        const repeatableQuests = repeatQuest(q, limitRepeatedQuest);
        resultQuests.push(repeatableQuests);
      } else {
        resultQuests.push([q]);
      }
    });

    return flatten(resultQuests);
  }

  /**
   * Replace whitespaces ' ' by '_' in ids for:
   * 1. all story items
   * 2. all rewards
   * 3. all start_rewards
   * 4. all locked_by_quests
   * 5. all unlock_on_quest_start
   * 6. all accepted_items
   *
   */
  private transformIds<T extends StoryItem>(item: T): T {
    const { id } = item;

    // 1. all story items
    const newId = id.replace(/ /g, "_");

    if (newId !== id) {
      this.logger.warning(`=> Custom Quests: id ${id} replaced by '${newId}'`);
    }

    // TODO: 2 all rewards
    // TODO: 3 all start_rewards
    // TODO: 4 all locked_by_quests
    // TODO: 5 all unlock_on_quest_start
    // TODO: 6 all accepted_items

    return {
      ...item,
      id: newId,
    };
  }

  public injectStory(
    story: StoryItem[],
    fileName = "@api-quest-loader"
  ): Quest[] {
    const quests: CustomQuest[] = story
      .filter(isStoryCustomQuest)
      .map(this.transformIds.bind(this));

    const itemBuilds: StoryItemBuild[] = story
      .filter(isStoryItemBuild)
      .map(this.transformIds.bind(this));

    const itemGroups: StoryAcceptedItemGroup[] = story
      .filter(isStoryAcceptedItemGroup)
      .map(this.transformIds.bind(this));

    if (itemBuilds.length) {
      this.debug(
        `${itemBuilds.length} item build template(s) detected in '${fileName}'`
      );
    }

    if (itemGroups.length) {
      this.debug(
        `${itemGroups.length} item group(s) detected in '${fileName}'`
      );
    }

    const expandedQuests = this.expandRepeatableQuests(quests);

    const questGen = new QuestsGenerator(
      expandedQuests,
      itemBuilds,
      itemGroups,
      this.db,
      this.logger
    );

    // array of tuple [quest, questLocales]
    const questsPayloads = questGen.generateWithLocales();

    return questsPayloads.map(([quest, questLocales]) => {
      this.loadQuest(quest);
      this.loadLocales(quest._id, questLocales);

      return quest;
    });
  }

  private loadFile(fileName: string, dir: string): Quest[] {
    const fullPath = join(dir, fileName);

    const storyOrQuest = readJsonFile<StoryItem | StoryItem[]>(fullPath);
    const story = "length" in storyOrQuest ? storyOrQuest : [storyOrQuest];

    return this.injectStory(story, fileName);
  }
}
