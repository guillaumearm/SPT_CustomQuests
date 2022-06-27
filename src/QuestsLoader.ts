import type { IQuest } from "@spt-aki/models/eft/common/tables/IQuest";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { VFS } from "@spt-aki/utils/VFS";

import { join } from "path";

import {
  CustomQuest,
  isStoryAcceptedItemGroup,
  isStoryCustomQuest,
  isStoryItemBuild,
  StoryItem,
} from "./customQuests";
import { GeneratedLocales } from "./CustomQuestsTransformer";
import { QuestsGenerator } from "./QuestsGenerator";
import { getAllLocales, readJsonFile } from "./utils";

export class QuestsLoader {
  constructor(
    private questDirectory: string,
    private db: DatabaseServer,
    private vfs: VFS,
    private logger: ILogger,
    private debug: (data: string) => void
  ) {
    this.questDirectory = questDirectory;
  }

  loadAll(): IQuest[] {
    let loadedQuests = this.loadDir(this.questDirectory);

    this.vfs.getDirs(this.questDirectory).forEach((subdir) => {
      if (subdir.endsWith(".disabled")) {
        if (subdir !== "examples.disabled") {
          this.logger.warning(
            `=> Custom Quests: skipped '${
              subdir.split(".disabled")[0]
            }' quest directory`
          );
        }
      } else {
        const loadedSubQuests = this.loadDir(join(this.questDirectory, subdir));
        loadedQuests = [...loadedQuests, ...loadedSubQuests];
      }
    });

    return loadedQuests;
  }

  private loadDir(dir: string): IQuest[] {
    let loadedQuests: IQuest[] = [];

    this.vfs.getFiles(dir).forEach((fileName) => {
      if (fileName.endsWith(".json")) {
        const quests = this.loadFile(fileName, dir);
        loadedQuests = [...loadedQuests, ...quests];
      }
    });

    return loadedQuests;
  }

  private loadQuest(quest: IQuest): void {
    const quests = this.db.getTables().templates.quests;

    if (quests[quest._id]) {
      this.logger.error(
        `=> Custom Quests: already registered questId '${quest._id}'`
      );
    } else {
      quests[quest._id] = quest;
    }
  }

  private loadLocales(
    questId: string,
    localesPayloads: GeneratedLocales
  ): void {
    const locales = this.db.getTables().locales;

    getAllLocales(this.db).forEach((localeName) => {
      const payload = localesPayloads[localeName];
      const globalLocales = locales.global[localeName];

      if (globalLocales.quest[questId]) {
        this.logger.error(
          `=> Custom Quests: already registered locales for questId '${questId}'`
        );
      } else {
        globalLocales.quest[questId] = payload.quest;
      }

      Object.keys(payload.mail).forEach((mailId) => {
        if (globalLocales.mail[mailId]) {
          this.logger.error(
            `=> Custom Quests: already registered mail '${mailId}' for questId '${questId}'`
          );
        } else {
          globalLocales.mail[mailId] = payload.mail[mailId];
        }
      });
    });
  }

  private loadFile(fileName: string, dir: string): IQuest[] {
    const fullPath = join(dir, fileName);

    const storyOrQuest = readJsonFile<StoryItem | StoryItem[]>(fullPath);
    const story = "length" in storyOrQuest ? storyOrQuest : [storyOrQuest];

    const quests: CustomQuest[] = story.filter(isStoryCustomQuest);
    const itemBuilds = story.filter(isStoryItemBuild);
    const itemGroups = story.filter(isStoryAcceptedItemGroup);

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

    const questGen = new QuestsGenerator(
      quests,
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
}
