import type {
  IQuestCondition,
  // Conditions,
  IQuestConditionCounterCondition,
  IQuest,
  IQuestConditionTypes,
} from "@spt/models/eft/common/tables/IQuest";

import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";

import { ALL_PLACES_BY_MAP } from "./allPlacesByMap";
import { ALL_ZONES_BY_MAP } from "./allZonesByMap";
import type {
  CustomQuest,
  LocaleName,
  MissionFindItem,
  MissionGiveItem,
  MissionKill,
  MissionPlaceBeacon,
  MissionPlaceItem,
  MissionPlaceSignalJammer,
  MissionVisitPlace,
  PossibleLocation,
  QuestMission,
  QuestString,
  StoryAcceptedItemGroup,
  StoryItemBuild,
} from "./customQuests";
import { RewardsGenerator } from "./RewardsGenerator";
import {
  flatten,
  getAllLocales,
  getSHA256,
  isNotNil,
  isNotUndefined,
} from "./utils";
import type { QuestTypeEnum } from "@spt/models/enums/QuestTypeEnum";

const QuestStatus = {
  Locked: 0,
  AvailableForStart: 1,
  Started: 2,
  AvailableForFinish: 3,
  Success: 4,
  Fail: 5,
  FailRestartable: 6,
  MarkedAsFailed: 7,
};

const ZONES: Record<string, string> = {};
Object.keys(ALL_ZONES_BY_MAP).forEach((mapName) => {
  ALL_ZONES_BY_MAP[mapName as keyof typeof ALL_ZONES_BY_MAP].forEach(
    (zoneId) => {
      ZONES[zoneId] = mapName;
    }
  );
});

const PLACES: Record<string, string> = {};
Object.keys(ALL_PLACES_BY_MAP).forEach((mapName) => {
  ALL_PLACES_BY_MAP[mapName as keyof typeof ALL_PLACES_BY_MAP].forEach(
    (zoneId) => {
      PLACES[zoneId] = mapName;
    }
  );
});

const FALLBACK_LOCALE = "en";
const DEFAULT_IMAGE_ID = "5a27cafa86f77424e20615d6";
const DEFAULT_LOCATION = "any";
const DEFAULT_TYPE = "Completion" as QuestTypeEnum;
const DEFAULT_SUCCESS_MESSAGE = "Quest successfully completed";
const DEFAULT_PLANT_TIME = 30;

const QUEST_STATUS_SUCCESS = [QuestStatus.Success];
const QUEST_STATUS_STARTED = [QuestStatus.Started, QuestStatus.Success];

const SIGNAL_JAMMER_ID = "5ac78a9b86f7741cca0bbd8d";
const BEACON_ITEM_ID = "5991b51486f77447b112d44f";

const TRADER_ALIASES = {
  prapor: "54cb50c76803fa8b248b4571",
  therapist: "54cb57776803fa99248b456e",
  fence: "579dc571d53a0658a154fbec",
  skier: "58330581ace78e27b8b10cee",
  peacekeeper: "5935c25fb3acc3127c3d8cd9",
  mechanic: "5a7c2eca46aef81a7ca2145d",
  ragman: "5ac3b934156ae10c4430e83c",
  jaeger: "5c0647fdd443bc2504c2d371",
};

const DESCRIPTIVE_LOCATION_ALIASES = {
  bigmap: "56f40101d2720b2a4d8b45d6",
  customs: "56f40101d2720b2a4d8b45d6",
  factory: "55f2d3fd4bdc2d5f408b4567",
  interchange: "5714dbc024597771384a510d",
  laboratory: "5b0fc42d86f7744a585f9105",
  labs: "5b0fc42d86f7744a585f9105",
  lighthouse: "5704e4dad2720bb55b8b4567",
  rezervbase: "5704e5fad2720bc05b8b4567",
  reserve: "5704e5fad2720bc05b8b4567",
  shoreline: "5704e554d2720bac5b8b456e",
  woods: "5704e3c2d2720bac5b8b4567",
};

const LOCATION_ALIASES = {
  factory: ["factory4_day", "factory4_night"],
  customs: ["bigmap"],
  reserve: ["RezervBase"],
  labs: ["laboratory"],
  woods: ["Woods"],
  shoreline: ["Shoreline"],
  interchange: ["Interchange"],
  lighthouse: ["Lighthouse"],
};

const getTargetFromLocations = (locations: string[]): string[] => {
  const result: string[] = [];

  locations.forEach((location) => {
    if (LOCATION_ALIASES[location as keyof typeof LOCATION_ALIASES]) {
      LOCATION_ALIASES[location as keyof typeof LOCATION_ALIASES].forEach(
        (l) => {
          result.push(l);
        }
      );
    } else {
      result.push(location);
    }
  });

  return result;
};

const getNeedSurviveTargetFromLocation = (location: string): string[] => {
  return location === "factory"
    ? ["factory4_day", "factory4_night"]
    : [location];
};

function generateKillConditionId(
  questId: string,
  mission: MissionKill
): string {
  return getSHA256(
    JSON.stringify([
      questId,
      // mission._id,
      mission.type,
      mission.count,
      mission.target,
      mission.locations,
    ])
  );
}

function generateGiveItemConditionId(
  questId: string,
  mission: MissionGiveItem
): string {
  return getSHA256(
    JSON.stringify([
      questId,
      // mission._id,
      mission.type,
      mission.accepted_items,
      mission.count,
      mission.found_in_raid_only || false,
    ])
  );
}

function generateFindItemConditionId(
  questId: string,
  mission: MissionFindItem
): string {
  return getSHA256(
    JSON.stringify([
      questId,
      // mission._id,
      mission.type,
      mission.accepted_items,
      mission.count,
    ])
  );
}

function generatePlaceBeaconConditionId(
  questId: string,
  mission: MissionPlaceBeacon | MissionPlaceSignalJammer | MissionPlaceItem
): string {
  return getSHA256(
    JSON.stringify([
      questId,
      // mission._id,
      mission.type,
      mission.zone_id,
      mission.plant_time,
      mission.need_survive,
    ])
  );
}

function generateVisitPlaceConditionId(
  questId: string,
  mission: MissionVisitPlace
): string {
  return getSHA256(
    JSON.stringify([
      questId,
      // mission._id,
      mission.type,
      mission.place_id,
      mission.need_survive,
    ])
  );
}

function generateLocationCondition(
  prefixId: string,
  givenLocations?: PossibleLocation[] | PossibleLocation
): IQuestConditionCounterCondition | undefined {
  if (!givenLocations || givenLocations === "any") {
    return undefined;
  }

  const locations = Array.isArray(givenLocations)
    ? givenLocations
    : [givenLocations];

  if (locations.includes("any") || !locations.length) {
    return undefined;
  }

  return {
    conditionType: "Location",
    dynamicLocale: false,
    target: getTargetFromLocations(locations),
    id: `${prefixId}_location`,
  };
}

class ConditionsGenerator {
  constructor(
    private customQuest: CustomQuest,
    private groups: Record<string, StoryAcceptedItemGroup>,
    private logger: ILogger
  ) {}

  private static setConditionsIndexes(
    conditions: (IQuestCondition | undefined)[]
  ) {
    return conditions.filter(isNotUndefined).map((payload, index) => {
      return {
        ...payload,
        index,
      };
    });
  }

  private generateLevelCondition(): IQuestCondition | undefined {
    const level_needed = this.customQuest.level_needed ?? 0;
    const qid = this.customQuest.id;

    if (level_needed > 1) {
      return {
        conditionType: "Level",
        index: 0,
        id: `${qid}_level_condition`,
        parentId: "",
        dynamicLocale: false,
        value: level_needed,
        compareMethod: ">=",
        visibilityConditions: [],
        target: "",
      };
    }

    return undefined;
  }

  private generateQuestCondition(
    questId: string,
    status = QUEST_STATUS_SUCCESS
  ): IQuestCondition | undefined {
    if (questId) {
      return {
        conditionType: "Quest",
        index: 0,
        id: "",
        parentId: "",
        dynamicLocale: false,
        target: questId,
        status: status,
      };
    }

    return undefined;
  }

  private generateAvailableForStart(): IQuestCondition[] {
    const locked_by_quests = this.customQuest.locked_by_quests || [];
    const unlock_on_quest_start = this.customQuest.unlock_on_quest_start || [];

    const levelCondition = this.generateLevelCondition();

    const questSuccessConditions = locked_by_quests.map((questId) =>
      this.generateQuestCondition(questId, QUEST_STATUS_SUCCESS)
    );
    const questStartedConditions = unlock_on_quest_start.map((questId) =>
      this.generateQuestCondition(questId, QUEST_STATUS_STARTED)
    );

    return ConditionsGenerator.setConditionsIndexes([
      levelCondition,
      ...questSuccessConditions,
      ...questStartedConditions,
    ]);
  }

  private generateKillCondition(mission: MissionKill): IQuestCondition | null {
    const killConditionId = generateKillConditionId(
      this.customQuest.id,
      mission
    );
    const count = mission.count === undefined ? 1 : mission.count;

    if (count <= 0) {
      return null;
    }

    const counterId = `${killConditionId}_counter`;

    const weapon = mission.weapons_whitelist
      ? this.getItemIdsFromAcceptedItems(mission.weapons_whitelist)
      : undefined;

    const conditions: IQuestConditionCounterCondition[] = [
      {
        conditionType: "Kills",
        id: `${counterId}_kill`,
        dynamicLocale: false,

        // target = 'Savage' | 'AnyPmc' | 'Bear' | 'Usec' | 'Any'
        target: mission.target || "Any",
        compareMethod: ">=",
        value: count, // TODO: check this ?
        weapon,
      },
      generateLocationCondition(killConditionId, mission.locations),
    ].filter(isNotUndefined);

    return {
      conditionType: "CounterCreator",
      index: 0,
      counter: {
        id: counterId,
        conditions: conditions,
      },
      id: killConditionId,
      parentId: "",
      oneSessionOnly: mission.one_session_only ?? false,
      dynamicLocale: false,
      // type: "Elimination",
      doNotResetIfCounterCompleted: false,
      value: String(count),
      visibilityConditions: [],
      target: "",
    };
  }

  private getItemIdsFromAcceptedItems(acceptedItems: string[]): string[] {
    return flatten(
      acceptedItems.map((id) => {
        const group = this.groups[id];

        if (group) {
          return group.items;
        }

        return [id];
      })
    );
  }

  private generateGiveItemCondition(
    mission: MissionGiveItem
  ): IQuestCondition | null {
    const items = mission.accepted_items;
    const count = mission.count === undefined ? 1 : mission.count;
    const fir = mission.found_in_raid_only || false;

    if (!items || !items.length || count <= 0) {
      return null;
    }

    const allItems = this.getItemIdsFromAcceptedItems(items);
    const id = generateGiveItemConditionId(this.customQuest.id, mission);

    return {
      conditionType: "HandoverItem",
      index: 0,
      id,
      dogtagLevel: 0,
      maxDurability: 100,
      minDurability: 0,
      parentId: "",
      onlyFoundInRaid: fir,
      dynamicLocale: false,
      target: allItems,
      value: String(count),
      visibilityConditions: [],
    };
  }

  private generateFindItemCondition(
    mission: MissionFindItem
  ): IQuestCondition | null {
    const items = mission.accepted_items;
    const count = mission.count === undefined ? 1 : mission.count;

    if (!items || !items.length || count <= 0) {
      return null;
    }

    const allItems = this.getItemIdsFromAcceptedItems(items);
    const id = generateFindItemConditionId(this.customQuest.id, mission);

    return {
      conditionType: "FindItem",
      index: 0,
      id,
      dogtagLevel: 0,
      maxDurability: 100,
      minDurability: 0,
      parentId: "",
      onlyFoundInRaid: true,
      dynamicLocale: false,
      target: allItems,
      value: String(count),
      visibilityConditions: [],
    };
  }

  private generatePlaceBeaconCondition(
    mission: MissionPlaceBeacon | MissionPlaceSignalJammer | MissionPlaceItem
  ): IQuestCondition | IQuestCondition[] | null {
    const qid = this.customQuest.id;

    if (!ZONES[mission.zone_id]) {
      this.logger.error(
        `=> Custom Quests: no valid zone_id provided for mission of type '${mission.type}' (concerned quest: ${qid})`
      );
      return null;
    }

    const id = generatePlaceBeaconConditionId(qid, mission);

    let accepted_items: string[] = [];
    let conditionType = "PlaceBeacon";

    if (mission.type === "PlaceBeacon") {
      accepted_items = [BEACON_ITEM_ID];
    } else if (mission.type === "PlaceSignalJammer") {
      accepted_items = [SIGNAL_JAMMER_ID];
    } else if (mission.type === "PlaceItem") {
      conditionType = "LeaveItemAtLocation";
      accepted_items = mission.accepted_items || [];

      if (!accepted_items.length) {
        this.logger.error(
          `=> in custom quest '${qid}': no accepted_items provided for a PlaceItem mission `
        );
        return null;
      }

      accepted_items = this.getItemIdsFromAcceptedItems(accepted_items);
    }

    const placeBeaconCondition: IQuestCondition = {
      conditionType,
      index: 0,
      id,
      dogtagLevel: 0,
      maxDurability: 100,
      minDurability: 0,
      parentId: "",
      onlyFoundInRaid: false,
      dynamicLocale: false,
      plantTime: mission.plant_time || DEFAULT_PLANT_TIME,
      zoneId: mission.zone_id,
      target: accepted_items,
      value: "1",
      visibilityConditions: [],
    };

    if (mission.need_survive) {
      const target = getNeedSurviveTargetFromLocation(ZONES[mission.zone_id]);

      return [
        placeBeaconCondition,
        {
          conditionType: "CounterCreator",
          target: "",
          index: 0,
          counter: {
            id: `${id}_counter`,
            conditions: [
              {
                conditionType: "Location",
                target: target,
                id: `${id}_condition_location`,
                dynamicLocale: false,
              },
              {
                conditionType: "ExitStatus",
                status: ["Survived", "Runner"],
                id: `${id}_condition_exitstatus`,
                target: [],
                dynamicLocale: false,
              },
            ],
          },
          id: `${id}_exit_location`,
          parentId: "",
          oneSessionOnly: mission.one_session_only ?? false,
          dynamicLocale: false,
          // type: "Completion", // TODO
          doNotResetIfCounterCompleted: false,
          value: "1",
          visibilityConditions: [
            {
              conditionType: "CompleteCondition",
              target: id,
              id: `${id}_visibility_condition`,
              dynamicLocale: false,
              oneSessionOnly: false, // TODO: test this
            },
          ],
        },
      ];
    }

    return placeBeaconCondition;
  }

  private generateVisitPlaceCondition(
    mission: MissionVisitPlace
  ): IQuestCondition | IQuestCondition[] | null {
    const qid = this.customQuest.id;

    if (!PLACES[mission.place_id]) {
      this.logger.error(
        `=> Custom Quests: no valid place_id provided for mission of type '${mission.type}' (concerned quest: ${qid})`
      );
      return null;
    }

    const id = generateVisitPlaceConditionId(qid, mission);

    const counterVisit: IQuestCondition = {
      conditionType: "CounterCreator",
      index: 0,
      target: "",
      counter: {
        id: `${id}_counter`,
        conditions: [
          {
            conditionType: "VisitPlace",
            target: mission.place_id,
            value: 1,
            id: `${id}_visit_place`,
            dynamicLocale: false,
          },
        ],
      },
      id: id,
      parentId: "",
      oneSessionOnly: mission.one_session_only ?? false,
      dynamicLocale: false,
      // type: "Exploration",
      doNotResetIfCounterCompleted: false,
      value: "1",
      visibilityConditions: [],
    };

    if (!mission.need_survive) {
      return counterVisit;
    }

    const target = getNeedSurviveTargetFromLocation(PLACES[mission.place_id]);

    const counterExit: IQuestCondition = {
      conditionType: "CounterCreator",
      target: "",
      index: 0,
      counter: {
        id: `${id}_exit_counter`,
        conditions: [
          {
            conditionType: "Location",
            target: target,
            id: `${id}_condition_location`,
            dynamicLocale: false,
          },
          {
            conditionType: "ExitStatus",
            status: ["Survived", "Runner"],
            id: `${id}_condition_exitstatus`,
            target: [],
            dynamicLocale: false,
          },
        ],
      },
      id: `${id}_exit_location`,
      parentId: "",
      oneSessionOnly: mission.one_session_only ?? false,
      dynamicLocale: false,
      // type: "Completion",
      doNotResetIfCounterCompleted: false,
      value: "1",
      visibilityConditions: [
        {
          conditionType: "CompleteCondition",
          target: id,
          id: `${id}_visibility_condition`,
          oneSessionOnly: false, // TODO
          dynamicLocale: false,
        },
      ],
    };

    return [counterVisit, counterExit];
  }

  private generateAvailableForFinish(): IQuestCondition[] {
    const missions = (this.customQuest.missions || [])
      .map((mission) => {
        if (mission.type === "Kill") {
          return this.generateKillCondition(mission);
        } else if (mission.type === "GiveItem") {
          return this.generateGiveItemCondition(mission);
        } else if (mission.type === "FindItem") {
          return this.generateFindItemCondition(mission);
        } else if (
          mission.type === "PlaceBeacon" ||
          mission.type === "PlaceSignalJammer" ||
          mission.type === "PlaceItem"
        ) {
          return this.generatePlaceBeaconCondition(mission);
        } else if (mission.type === "VisitPlace") {
          return this.generateVisitPlaceCondition(mission);
        }

        this.logger.warning(
          `=> Custom Quests: ignored mission with type '${
            (mission as any).type
          }'`
        );

        return undefined;
      })
      .filter(isNotNil)
      .map((condition) => {
        if (Array.isArray(condition)) {
          return condition;
        }

        return [condition];
      });

    return ConditionsGenerator.setConditionsIndexes(flatten(missions));
  }

  private generateFail() {
    // TODO
    return [];
  }

  // if adding values here, getConditionsIdsMappingFromTemplate should be impacted
  generateConditions(): IQuestConditionTypes {
    return {
      AvailableForStart: this.generateAvailableForStart(),
      AvailableForFinish: this.generateAvailableForFinish(),
      Fail: this.generateFail(),
      Started: [],
      Success: [],
    };
  }
}

export type GeneratedLocales = Record<
  string,
  { mail: Record<string, string>; quest: IQuest }
>;

export class CustomQuestsTransformer {
  private conditionsGenerator: ConditionsGenerator;
  private rewardsGenerator: RewardsGenerator;

  constructor(
    private customQuest: CustomQuest,
    private questPrefixName = "",
    builds: Record<string, StoryItemBuild>,
    groups: Record<string, StoryAcceptedItemGroup>,
    private db: DatabaseServer,
    logger: ILogger
  ) {
    this.conditionsGenerator = new ConditionsGenerator(
      customQuest,
      groups,
      logger
    );
    this.rewardsGenerator = new RewardsGenerator(customQuest, builds);
  }

  public static getTraderId(traderIdOrAlias: string): string {
    const lowerCasedId = traderIdOrAlias.toLowerCase();
    if (TRADER_ALIASES[lowerCasedId as keyof typeof TRADER_ALIASES]) {
      return TRADER_ALIASES[lowerCasedId as keyof typeof TRADER_ALIASES];
    }

    return traderIdOrAlias;
  }

  private getDescriptiveLocation(): string {
    const location = this.customQuest.descriptive_location || DEFAULT_LOCATION;

    const lowerCasedLocation = location.toLowerCase();
    if (
      DESCRIPTIVE_LOCATION_ALIASES[
        lowerCasedLocation as keyof typeof DESCRIPTIVE_LOCATION_ALIASES
      ]
    ) {
      return DESCRIPTIVE_LOCATION_ALIASES[
        lowerCasedLocation as keyof typeof DESCRIPTIVE_LOCATION_ALIASES
      ];
    }

    return location;
  }

  public generateQuest(): IQuest {
    const q = this.customQuest;
    const questId = q.id;
    const traderId = CustomQuestsTransformer.getTraderId(q.trader_id);
    const image = `/files/quest/icon/${q.image || DEFAULT_IMAGE_ID}.jpg`;
    const location = this.getDescriptiveLocation();
    const type = q.type || DEFAULT_TYPE;
    const conditions = this.conditionsGenerator.generateConditions();
    const rewards = this.rewardsGenerator.generateAllRewards();

    return {
      QuestName: questId,
      _id: questId,
      status: "",
      questStatus: 1,
      image,
      type,
      traderId,
      location,
      conditions,
      rewards,
      canShowNotificationsInGame: true,
      description: `${questId} description`,
      failMessageText: `${questId} failMessageText`,
      name: `${questId} name`,
      note: `${questId} note`,
      isKey: false,
      KeyQuest: false,
      restartable: false,
      instantComplete: false,
      secretQuest: false,
      side: "Pmc",
      acceptPlayerMessage: `${questId} acceptPlayerMessage`,
      declinePlayerMessage: `${questId} declinePlayerMessage`,
      completePlayerMessage: `${questId} completePlayerMessage`,
      startedMessageText: `${questId} startedMessageText`,
      changeQuestMessageText: `${questId} changeQuestMessageText`,
      successMessageText: q.success_message
        ? `${questId} successMessageText`
        : DEFAULT_SUCCESS_MESSAGE,
      templateId: questId,
    };
  }

  private static getLocaleValue(
    givenPayload: QuestString | string | undefined,
    localeName: string
  ): string {
    if (typeof givenPayload === "string") {
      return givenPayload;
    }

    const payload = givenPayload || {};
    return payload[localeName as LocaleName] || payload[FALLBACK_LOCALE] || "";
  }

  private getMissionId(mission: QuestMission): string | null {
    const qid = this.customQuest.id;

    if (mission.type === "Kill") {
      return generateKillConditionId(qid, mission);
    } else if (mission.type === "GiveItem") {
      return generateGiveItemConditionId(qid, mission);
    } else if (mission.type === "FindItem") {
      return generateFindItemConditionId(qid, mission);
    } else if (
      mission.type === "PlaceBeacon" ||
      mission.type === "PlaceSignalJammer" ||
      mission.type === "PlaceItem"
    ) {
      return generatePlaceBeaconConditionId(qid, mission);
    } else if (mission.type === "VisitPlace") {
      return generateVisitPlaceConditionId(qid, mission);
    }
    return null;
  }

  generateLocales(generatedQuest: IQuest): GeneratedLocales {
    const {
      name,
      description,
      success_message,
      missions,
      id: qid,
      trader_id,
    } = this.customQuest;
    const { location, templateId } = generatedQuest;

    const result: GeneratedLocales = {};

    const allLocales = getAllLocales(this.db);

    // TODO: check how locales work with quests
    allLocales.forEach((localeName) => {
      const payload: IQuest = {
        // ...generatedQuest,
        name: "",
        description: "",
        conditions: {
          Started: [],
          AvailableForFinish: [],
          AvailableForStart: [],
          Success: [],
          Fail: [],
        },
        note: "",
        failMessageText: "",
        startedMessageText: "",
        successMessageText: "",
        location,
      };

      payload.name =
        this.questPrefixName +
        CustomQuestsTransformer.getLocaleValue(name, localeName);

      payload.description = `${templateId}_description`;
      if (success_message) {
        payload.successMessageText = `${templateId}_success_message_text`;
      }

      payload.conditions = {
        Started: [],
        AvailableForFinish: [],
        AvailableForStart: [],
        Success: [],
        Fail: [],
      };

      (missions || []).forEach((mission) => {
        const missionId = this.getMissionId(mission);
        if (missionId) {
          payload.conditions[missionId] =
            CustomQuestsTransformer.getLocaleValue(mission.message, localeName);
        }

        const needSurvive = (mission as MissionVisitPlace).need_survive;

        if (needSurvive) {
          payload.conditions[`${missionId}_exit_location`] =
            CustomQuestsTransformer.getLocaleValue(needSurvive, localeName);
        }
      });

      if (!result[localeName]) {
        result[localeName] = { quest: payload, mail: {} };
      }

      result[localeName].mail[payload.description] =
        CustomQuestsTransformer.getLocaleValue(description, localeName);

      if (success_message) {
        result[localeName].mail[payload.successMessageText] =
          CustomQuestsTransformer.getLocaleValue(success_message, localeName);
      }
    });

    return result;
  }
}
