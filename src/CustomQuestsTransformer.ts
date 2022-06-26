import type {
  AvailableForConditions,
  Conditions,
  CounterCondition,
  IQuest,
} from "@spt-aki/models/eft/common/tables/IQuest";
import type { ILocaleQuest } from "@spt-aki/models/spt/server/ILocaleBase";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";

import { ALL_PLACES_BY_MAP } from "./allPlacesByMap";
import { ALL_ZONES_BY_MAP } from "./allZonesByMap";
import {
  CustomQuest,
  LocaleName,
  MissionGiveItem,
  MissionKill,
  MissionPlaceBeacon,
  MissionPlaceItem,
  MissionPlaceSignalJammer,
  MissionVisitPlace,
  QuestMission,
  QuestString,
} from "./customQuests";
import { RewardsGenerator } from "./RewardsGenerator";
import { getAllLocales, getSHA256, isNotUndefined } from "./utils";

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
const DEFAULT_TYPE = "Completion";
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

class ConditionsGenerator {
  constructor(private customQuest: CustomQuest, private logger: ILogger) {}

  private static setPropsIndexes(
    conditions: (AvailableForConditions | undefined)[]
  ) {
    return conditions.filter(isNotUndefined).map((payload, index) => {
      return {
        ...payload,
        _props: {
          ...payload._props,
          index,
        },
      };
    });
  }

  private _generateLevelCondition(): AvailableForConditions | undefined {
    const level_needed = this.customQuest.level_needed ?? 0;
    const qid = this.customQuest.id;

    if (level_needed > 1) {
      return {
        _parent: "Level",
        _props: {
          index: 0,
          id: `${qid}_level_condition`,
          parentId: "",
          dynamicLocale: false,
          value: level_needed,
          compareMethod: ">=",
          visibilityConditions: [],
        },
        dynamicLocale: false,
      };
    }

    return undefined;
  }

  private _generateQuestCondition(
    questId: string,
    status = QUEST_STATUS_SUCCESS
  ): AvailableForConditions | undefined {
    if (questId) {
      return {
        _parent: "Quest",
        _props: {
          index: 0,
          id: "",
          parentId: "",
          dynamicLocale: false,
          target: questId,
          status: status,
        },
        dynamicLocale: false,
      };
    }

    return undefined;
  }

  private _generateAvailableForStart(): AvailableForConditions[] {
    const locked_by_quests = this.customQuest.locked_by_quests || [];
    const unlock_on_quest_start = this.customQuest.unlock_on_quest_start || [];

    const levelCondition = this._generateLevelCondition();

    const questSuccessConditions = locked_by_quests.map((questId) =>
      this._generateQuestCondition(questId, QUEST_STATUS_SUCCESS)
    );
    const questStartedConditions = unlock_on_quest_start.map((questId) =>
      this._generateQuestCondition(questId, QUEST_STATUS_STARTED)
    );

    return ConditionsGenerator.setPropsIndexes([
      levelCondition,
      ...questSuccessConditions,
      ...questStartedConditions,
    ]);
  }

  _generateKillCondition(mission: MissionKill): AvailableForConditions | null {
    const killConditionId = generateKillConditionId(
      this.customQuest.id,
      mission
    );
    const count = mission.count === undefined ? 1 : mission.count;

    if (count <= 0) {
      return null;
    }

    const conditions: CounterCondition[] = [
      {
        _parent: "Kills",
        _props: {
          // target = 'Savage' | 'AnyPmc' | 'Bear' | 'Usec
          target: mission.target || "Savage",
          compareMethod: ">=",
          value: "1",
          id: `${killConditionId}_kill`,
        },
      },
      mission.locations &&
      (mission.locations as unknown as string) !== "any" &&
      !mission.locations.includes("any")
        ? {
            _parent: "Location",
            _props: {
              target: getTargetFromLocations(mission.locations),
              id: `${killConditionId}_location`,
            },
          }
        : undefined,
    ].filter(isNotUndefined);

    return {
      _parent: "CounterCreator",
      _props: {
        index: 0,
        counter: {
          id: `${killConditionId}_counter`,
          conditions: conditions,
        },
        id: killConditionId,
        parentId: "",
        oneSessionOnly: false,
        dynamicLocale: false,
        type: "Elimination",
        doNotResetIfCounterCompleted: false,
        value: String(count),
        visibilityConditions: [],
      },
      dynamicLocale: false,
    };
  }

  _generateGiveItemCondition(
    mission: MissionGiveItem
  ): AvailableForConditions | null {
    const items = mission.accepted_items;
    const count = mission.count === undefined ? 1 : mission.count;
    const fir = mission.found_in_raid_only || false;

    if (!items || !items.length || count <= 0) {
      return null;
    }

    const id = generateGiveItemConditionId(this.customQuest.id, mission);

    return {
      _parent: "HandoverItem",
      _props: {
        index: 0,
        id,
        dogtagLevel: 0,
        maxDurability: 100,
        minDurability: 0,
        parentId: "",
        onlyFoundInRaid: fir,
        dynamicLocale: false,
        target: items,
        value: String(count),
        visibilityConditions: [],
      },
      dynamicLocale: false,
    };
  }

  _generatePlaceBeaconCondition(
    mission: MissionPlaceBeacon | MissionPlaceSignalJammer | MissionPlaceItem
  ): AvailableForConditions | AvailableForConditions[] | null {
    const qid = this.customQuest.id;

    if (!ZONES[mission.zone_id]) {
      this.logger.error(
        `=> Custom Quests: no valid zone_id provided for mission of type '${mission.type}' (concerned quest: ${qid})`
      );
      return null;
    }

    const id = generatePlaceBeaconConditionId(qid, mission);

    let accepted_items: string[] = [];
    let _parent = "PlaceBeacon";

    if (mission.type === "PlaceBeacon") {
      accepted_items = [BEACON_ITEM_ID];
    } else if (mission.type === "PlaceSignalJammer") {
      accepted_items = [SIGNAL_JAMMER_ID];
    } else if (mission.type === "PlaceItem") {
      _parent = "LeaveItemAtLocation";
      accepted_items = mission.accepted_items || [];

      if (!accepted_items.length) {
        this.logger.error(
          `=> in custom quest '${qid}': no accepted_items provided for a PlaceItem mission `
        );
        return null;
      }
    }

    const placeBeaconCondition: AvailableForConditions = {
      _parent,
      _props: {
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
      },
      dynamicLocale: false,
    };

    if (mission.need_survive) {
      const target = getNeedSurviveTargetFromLocation(ZONES[mission.zone_id]);

      return [
        placeBeaconCondition,
        {
          _parent: "CounterCreator",
          _props: {
            index: 0,
            counter: {
              id: `${id}_counter`,
              conditions: [
                {
                  _parent: "Location",
                  _props: {
                    target: target,
                    id: `${id}_condition_location`,
                  },
                },
                {
                  _parent: "ExitStatus",
                  _props: {
                    status: ["Survived", "Runner"],
                    id: `${id}_condition_exitstatus`,
                    target: [],
                  },
                },
              ],
            },
            id: `${id}_exit_location`,
            parentId: "",
            oneSessionOnly: false,
            dynamicLocale: false,
            type: "Completion",
            doNotResetIfCounterCompleted: false,
            value: "1",
            visibilityConditions: [
              {
                _parent: "CompleteCondition",
                _props: {
                  target: id,
                  id: `${id}_visibility_condition`,
                },
              },
            ],
          },
          dynamicLocale: false,
        },
      ];
    }

    return placeBeaconCondition;
  }

  _generateVisitPlaceCondition(
    mission: MissionVisitPlace
  ): AvailableForConditions | AvailableForConditions[] | null {
    const qid = this.customQuest.id;

    if (!PLACES[mission.place_id]) {
      this.logger.error(
        `=> Custom Quests: no valid place_id provided for mission of type '${mission.type}' (concerned quest: ${qid})`
      );
      return null;
    }

    const id = generateVisitPlaceConditionId(qid, mission);

    const counterVisit: AvailableForConditions = {
      _parent: "CounterCreator",
      _props: {
        index: 0,
        counter: {
          id: `${id}_counter`,
          conditions: [
            {
              _parent: "VisitPlace",
              _props: {
                target: mission.place_id,
                value: "1",
                id: `${id}_visit_place`,
              },
            },
          ],
        },
        id: id,
        parentId: "",
        oneSessionOnly: false,
        dynamicLocale: false,
        type: "Exploration",
        doNotResetIfCounterCompleted: false,
        value: "1",
        visibilityConditions: [],
      },
      dynamicLocale: false,
    };

    if (!mission.need_survive) {
      return counterVisit;
    }

    const target = getNeedSurviveTargetFromLocation(PLACES[mission.place_id]);

    const counterExit: AvailableForConditions = {
      _parent: "CounterCreator",
      _props: {
        index: 0,
        counter: {
          id: `${id}_exit_counter`,
          conditions: [
            {
              _parent: "Location",
              _props: {
                target: target,
                id: `${id}_condition_location`,
              },
            },
            {
              _parent: "ExitStatus",
              _props: {
                status: ["Survived", "Runner"],
                id: `${id}_condition_exitstatus`,
                target: [],
              },
            },
          ],
        },
        id: `${id}_exit_location`,
        parentId: "",
        oneSessionOnly: false,
        dynamicLocale: false,
        type: "Completion",
        doNotResetIfCounterCompleted: false,
        value: "1",
        visibilityConditions: [
          {
            _parent: "CompleteCondition",
            _props: {
              target: id,
              id: `${id}_visibility_condition`,
            },
          },
        ],
      },
      dynamicLocale: false,
    };

    return [counterVisit, counterExit];
  }

  _generateAvailableForFinish(): AvailableForConditions[] {
    const missions = (this.customQuest.missions || [])
      .map((mission) => {
        if (mission.type === "Kill") {
          return this._generateKillCondition(mission);
        } else if (mission.type === "GiveItem") {
          return this._generateGiveItemCondition(mission);
        } else if (
          mission.type === "PlaceBeacon" ||
          mission.type === "PlaceSignalJammer" ||
          mission.type === "PlaceItem"
        ) {
          return this._generatePlaceBeaconCondition(mission);
        } else if (mission.type === "VisitPlace") {
          return this._generateVisitPlaceCondition(mission);
        }

        this.logger.warning(
          `=> Custom Quests: ignored mission with type '${
            (mission as any).type
          }'`
        );

        return undefined;
      })
      .filter((item) => Boolean(item));

    // flattens missions array
    const flattenedMissions: AvailableForConditions[] = [];
    missions.forEach((mission) => {
      if (Array.isArray(mission)) {
        mission.forEach((m) => {
          if (m) flattenedMissions.push(m);
        });
      } else if (mission) {
        flattenedMissions.push(mission);
      }
    });

    return ConditionsGenerator.setPropsIndexes(flattenedMissions);
  }

  _generateFail() {
    // TODO
    return [];
  }

  generateConditions(): Conditions {
    return {
      AvailableForStart: this._generateAvailableForStart(),
      AvailableForFinish: this._generateAvailableForFinish(),
      Fail: this._generateFail(),
    };
  }
}

export type GeneratedLocales = Record<
  string,
  { mail: Record<string, string>; quest: ILocaleQuest }
>;

export class CustomQuestsTransformer {
  private conditionsGenerator: ConditionsGenerator;
  private rewardsGenerator: RewardsGenerator;

  constructor(
    private customQuest: CustomQuest,
    private db: DatabaseServer,
    logger: ILogger
  ) {
    this.conditionsGenerator = new ConditionsGenerator(customQuest, logger);
    this.rewardsGenerator = new RewardsGenerator(customQuest);
  }

  private _getTraderId(): string {
    const traderId = this.customQuest.trader_id;

    const lowerCasedId = traderId.toLowerCase();
    if (TRADER_ALIASES[lowerCasedId as keyof typeof TRADER_ALIASES]) {
      return TRADER_ALIASES[lowerCasedId as keyof typeof TRADER_ALIASES];
    }

    return traderId;
  }

  private _getDescriptiveLocation(): string {
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
    const traderId = this._getTraderId();
    const image = `/files/quest/icon/${q.image || DEFAULT_IMAGE_ID}.jpg`;
    const location = this._getDescriptiveLocation();
    const type = q.type || DEFAULT_TYPE;
    const conditions = this.conditionsGenerator.generateConditions();
    const rewards = this.rewardsGenerator.generateAllRewards();

    return {
      QuestName: questId,
      _id: questId,
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
      restartable: false,
      instantComplete: false,
      secretQuest: false,
      startedMessageText: `${questId} startedMessageText`,
      successMessageText: q.success_message
        ? `${questId} successMessageText`
        : DEFAULT_SUCCESS_MESSAGE,
      templateId: questId,
    };
  }

  static getLocaleValue(
    givenPayload: QuestString | string | undefined,
    localeName: string
  ): string {
    if (typeof givenPayload === "string") {
      return givenPayload;
    }

    const payload = givenPayload || {};
    return payload[localeName as LocaleName] || payload[FALLBACK_LOCALE] || "";
  }

  public getMissionId(mission: QuestMission): string | null {
    const qid = this.customQuest.id;

    if (mission.type === "Kill") {
      return generateKillConditionId(qid, mission);
    } else if (mission.type === "GiveItem") {
      return generateGiveItemConditionId(qid, mission);
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

  public generateLocales(generatedQuest: IQuest): GeneratedLocales {
    const { name, description, success_message, missions } = this.customQuest;
    const { location, templateId } = generatedQuest;

    const result: GeneratedLocales = {};

    const allLocales = getAllLocales(this.db);

    allLocales.forEach((localeName) => {
      const payload: ILocaleQuest = {
        name: "",
        description: "",
        conditions: {},
        note: "",
        failMessageText: "",
        startedMessageText: "",
        successMessageText: "",
        location,
      };

      payload.name = CustomQuestsTransformer.getLocaleValue(name, localeName);
      payload.description = `${templateId}_description`;
      if (success_message) {
        payload.successMessageText = `${templateId}_success_message_text`;
      }

      payload.conditions = {};

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
