const ALL_DESCRIPTIVE_LOCATION_OBJ = {
  any: true,
  customs: true,
  factory: true,
  laboratory: true,
  interchange: true,
  lighthouse: true,
  reserve: true,
  shoreline: true,
  woods: true,
};

const ALL_LOCATIONS_OBJ = {
  any: true,
  customs: true,
  factory: true, // night and day
  factory4_day: true, // day only
  factory4_night: true, // night only
  laboratory: true,
  interchange: true,
  lighthouse: true,
  reserve: true,
  shoreline: true,
  woods: true,
};

export const ALL_LOCATIONS = Object.keys(ALL_LOCATIONS_OBJ);
export type PossibleLocation = keyof typeof ALL_LOCATIONS_OBJ;

export const ALL_DESCRIPTIVE_LOCATION = Object.keys(
  ALL_DESCRIPTIVE_LOCATION_OBJ
);

export type DescriptiveLocation = keyof typeof ALL_DESCRIPTIVE_LOCATION_OBJ;

export type LocalizedString = {
  ch?: string;
  cz?: string;
  en?: string;
  "es-mx"?: string;
  es?: string;
  fr?: string;
  ge?: string;
  hu?: string;
  it?: string;
  jp?: string;
  kr?: string;
  pl?: string;
  po?: string;
  ru?: string;
  sk?: string;
  tu?: string;
};

export type LocaleName = keyof LocalizedString;

export type QuestType =
  | "Completion"
  | "PickUp"
  | "Elimination"
  | "Loyalty"
  | "Discover";
export type QuestString = string | LocalizedString;

export type KillTarget = "Savage" | "AnyPmc" | "Usec" | "Bear" | "Any";

export type MissionKill = {
  type: "Kill";
  target?: KillTarget;
  locations?: PossibleLocation[] | PossibleLocation;
  one_session_only?: boolean;
  count?: number;
  message?: QuestString;
};

export type MissionGiveItem = {
  type: "GiveItem";
  accepted_items: string[];
  count?: number;
  found_in_raid_only?: boolean;
  message?: QuestString;
};

export type MissionFindItem = {
  type: "FindItem";
  accepted_items: string[];
  count?: number;
  message?: QuestString;
};

type CommonPlaceX = {
  zone_id: string; // TODO list all zone ids;
  plant_time?: number;
  need_survive?: QuestString;
  one_session_only?: boolean;
  message?: QuestString;
};

export type MissionPlaceItem = {
  type: "PlaceItem";
  accepted_items: string[];
} & CommonPlaceX;

export type MissionPlaceBeacon = {
  type: "PlaceBeacon";
} & CommonPlaceX;

export type MissionPlaceSignalJammer = {
  type: "PlaceSignalJammer";
} & CommonPlaceX;

export type MissionVisitPlace = {
  type: "VisitPlace";
  place_id: string; // TODO: list all place ids
  need_survive?: QuestString;
  one_session_only?: boolean;
  message?: QuestString;
};

export type QuestMission =
  | MissionKill
  | MissionGiveItem
  | MissionFindItem
  | MissionPlaceItem
  | MissionPlaceBeacon
  | MissionPlaceSignalJammer
  | MissionVisitPlace;

export type QuestRewards = {
  xp?: number;
  items?: {
    [itemId: string]: number;
  };
};

export type CustomQuest = {
  id: string;
  trader_id: string;
  disabled?: boolean;
  descriptive_location?: DescriptiveLocation;
  type?: QuestType;
  image?: string;
  name?: QuestString;
  description?: QuestString;
  success_message?: QuestString;
  level_needed?: number;
  locked_by_quests?: string[];
  unlock_on_quest_start?: string[];
  missions?: QuestMission[];
  rewards?: QuestRewards;
  start_rewards?: QuestRewards;
};

export type StoryItemBuildBase = {
  item: string; // item template id
  attachments?: Record<string, StoryItemBuildBase>; // indexed by slotId
};

export type StoryItemBuild = StoryItemBuildBase & {
  type: "@build";
  id: string; // can be used for rewards
};

export type StoryAcceptedItemGroup = {
  type: "@group";
  id: string; // can be used for accepted_items
  items: string[]; // list of item template ids
};

export type StoryItem = CustomQuest | StoryItemBuild | StoryAcceptedItemGroup;

/**
 * Story helpers
 */
export const isStoryItemBuild = (item: StoryItem): item is StoryItemBuild => {
  return item.type === "@build";
};

export const isStoryAcceptedItemGroup = (
  item: StoryItem
): item is StoryAcceptedItemGroup => {
  return item.type === "@group";
};

export const isStoryCustomQuest = (item: StoryItem): item is CustomQuest => {
  return !isStoryItemBuild(item) && !isStoryAcceptedItemGroup(item);
};
