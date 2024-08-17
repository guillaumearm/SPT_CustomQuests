// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const quests = require("./quests.json");

const MAP_BY_IDS = {
  "56f40101d2720b2a4d8b45d6": "bigmap",
  "55f2d3fd4bdc2d5f408b4567": "factory4_day",
  "59fc81d786f774390775787e": "factory4_night",
  "5714dbc024597771384a510d": "interchange",
  "5b0fc42d86f7744a585f9105": "laboratory",
  "5704e4dad2720bb55b8b4567": "lighthouse",
  "5704e5fad2720bc05b8b4567": "rezervbase",
  "5704e554d2720bac5b8b456e": "shoreline",
  "5704e3c2d2720bac5b8b4567": "woods",
  "5714dc692459777137212e12": "streets",
  "653e6760052c01c1c805532f": "sandbox",
  any: "Any",
};

const displayPlacesForQuest = (quest) => {
  const res = [];

  quest.conditions.AvailableForFinish.forEach((condition) => {
    if (condition.conditionType === "CounterCreator") {
      //   console.log(condition);
      condition?.counter?.conditions?.forEach((counterCondition) => {
        if (counterCondition.conditionType === "VisitPlace") {
          res.push({
            placeId: counterCondition.target,
            location: MAP_BY_IDS[quest.location],
          });
        }
      });
    }
  });

  return res;
};

const main = () => {
  const resultByMaps = {};

  const places = Object.keys(quests).flatMap((questId) => {
    return displayPlacesForQuest(quests[questId]);
  });

  places.forEach((place) => {
    if (!place.location) {
      return;
    }

    if (!resultByMaps[place.location]) {
      resultByMaps[place.location] = {};
    }

    resultByMaps[place.location][place.placeId] = true;
  });

  // eslint-disable-next-line no-undef
  console.log(resultByMaps);
};

main();
