const utils = require('./utils');
const RewardsGenerator = require('./RewardsGenerator');

const FALLBACK_LOCALE = 'en';
const DEFAULT_IMAGE_ID = '5a27cafa86f77424e20615d6';
const DEFAULT_LOCATION = 'any';
const DEFAULT_TYPE = 'Completion';

const QUEST_STATUS_SUCCESS = [QuestHelper.status.Success];
const QUEST_STATUS_STARTED = [QuestHelper.status.Started, QuestHelper.status.Success];

class ConditionsGenerator {
  constructor(customQuest, dependencyQuest) {
    this.customQuest = customQuest;
    this.dependencyQuest = dependencyQuest;
  }

  static setPropsIndexes(conditions) {
    return conditions
      .filter(payload => Boolean(payload))
      .map((payload, index) => {
        return {
          ...payload,
          _props: {
            ...payload._props,
            index,
          },
        };
      });
  }

  _generateLevelCondition() {
    const level_needed = this.customQuest.level_needed;
    const qid = this.customQuest.id;

    if (level_needed > 1) {
      return {
        "_parent": "Level",
        "_props": {
          "id": `${qid}_level_condition`,
          "parentId": "",
          "dynamicLocale": false,
          "value": level_needed,
          "compareMethod": ">=",
          "visibilityConditions": []
        },
        "dynamicLocale": false
      }
    }
  }

  _generateQuestCondition(questId, status = QUEST_STATUS_SUCCESS) {
    if (questId) {
      return {
        "_parent": "Quest",
        "_props": {
          "id": "",
          "parentId": "",
          "dynamicLocale": false,
          "target": questId,
          "status": status,
        },
        "dynamicLocale": false
      }
    }
  }

  _generateAvailableForStart() {
    const locked_by_quests = this.customQuest.locked_by_quests || [];
    const unlock_on_quest_start = this.customQuest.unlock_on_quest_start || [];

    const levelCondition = this._generateLevelCondition();

    const dependencyQuestCondition = this._generateQuestCondition(this.dependencyQuest, QUEST_STATUS_SUCCESS);
    const questSuccessConditions = locked_by_quests.map(questId => this._generateQuestCondition(questId, QUEST_STATUS_SUCCESS));
    const questStartedConditions = unlock_on_quest_start.map(questId => this._generateQuestCondition(questId, QUEST_STATUS_STARTED));

    return ConditionsGenerator.setPropsIndexes([levelCondition, dependencyQuestCondition, ...questSuccessConditions, ...questStartedConditions]);
  }

  // killType = 'Savage' | 'AnyPmc' | 'Bear' | 'Usec
  _generateKillCondition(count, killType, locations) {
    const killConditionId = utils.getSHA256(JSON.stringify([count, killType, locations, this.customQuest.id]));

    if (count > 0) {
      const conditions = [
        {
          "_parent": "Kills",
          "_props": {
            "target": killType,
            "compareMethod": ">=",
            "value": "1",
            "id": `${killConditionId}_kill`
          }
        },
        locations && locations !== 'any' ? {
          "_parent": "Location",
          "_props": {
            "target": locations,
            "id": `${killConditionId}_location`
          }
        } : null,
      ].filter(c => Boolean(c));

      return {
        "_parent": "CounterCreator",
        "_props": {
          "counter": {
            "id": `${killConditionId}_counter`,
            "conditions": conditions
          },
          "id": killConditionId,
          "parentId": "",
          "oneSessionOnly": false,
          "dynamicLocale": false,
          "type": "Elimination",
          "doNotResetIfCounterCompleted": false,
          "value": String(count),
          "visibilityConditions": []
        },
        "dynamicLocale": false
      };
    }
  }

  _generateGiveItemCondition(items, count, fir = false) {
    if (!items || !items.length || count <= 0) {
      return null;
    }

    const id = utils.getSHA256(JSON.stringify([items, count, fir, this.customQuest.id]));

    return {
      "_parent": "HandoverItem",
      "_props": {
        id,
        "dogtagLevel": 0,
        "maxDurability": 100,
        "minDurability": 0,
        "parentId": "",
        "onlyFoundInRaid": fir,
        "dynamicLocale": false,
        "target": items,
        "value": String(count),
        "visibilityConditions": []
      },
      "dynamicLocale": false
    }
  }

  _generateAvailableForFinish() {
    const missions = this.customQuest.missions || [];
    return missions
      .map(mission => {
        if (mission.type === 'Kill') {
          return this._generateKillCondition(mission.count, mission.target, mission.locations);
        } else if (mission.type === 'GiveItem') {
          return this._generateGiveItemCondition(mission.accepted_items, mission.count, mission.found_in_raid_only);
        }

        Logger.warning(`=> Custom Quests: ignored mission with type '${mission.type}'`)

        return null;
      }).filter(item => Boolean(item));
  }

  _generateFail() {
    // TODO
    return [];
  }

  generateConditions() {
    return {
      AvailableForStart: this._generateAvailableForStart(),
      AvailableForFinish: this._generateAvailableForFinish(),
      Fail: this._generateFail(),
    }
  }
}


class CustomQuestsTransformer {
  constructor(customQuest, dependencyQuest) {
    this.customQuest = customQuest;
    this.dependencyQuest = dependencyQuest;

    this.conditionsGenerator = new ConditionsGenerator(customQuest, dependencyQuest);
    this.rewardsGenerator = new RewardsGenerator(customQuest);
  }

  generateQuest() {
    const q = this.customQuest;
    const questId = q.id;
    const traderId = q.trader_id;
    const image = `/files/quest/icon/${q.image || DEFAULT_IMAGE_ID}.jpg`;
    const location = q.location || DEFAULT_LOCATION;
    const type = q.type || DEFAULT_TYPE;
    const conditions = this.conditionsGenerator.generateConditions();
    const rewards = this.rewardsGenerator.generateRewards();

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
      successMessageText: `${questId} successMessageText`,
      templateId: questId,
    };
  }

  static getLocaleValue(givenPayload, localeName) {
    const payload = givenPayload || {};
    return payload[localeName] || payload[FALLBACK_LOCALE] || '';
  }

  getMissionId(mission) {
    if (mission.type === 'Kill') {
      return utils.getSHA256(JSON.stringify([mission.count, mission.target, mission.locations, this.customQuest.id]));
    } else if (mission.type === 'GiveItem') {
      return utils.getSHA256(JSON.stringify([mission.accepted_items, mission.count, mission.found_in_raid_only, this.customQuest.id]));
    }
    return null;
  }

  generateLocales(generatedQuest) {
    const { name, description, success_message, missions } = this.customQuest;
    const { location, templateId } = generatedQuest;

    const result = {};

    utils.ALL_LOCALES.forEach(localeName => {
      const payload = {
        note: "",
        failMessageText: "",
        startedMessageText: "",
        location,
      };

      payload.name = CustomQuestsTransformer.getLocaleValue(name, localeName);
      payload.description = `${templateId}_description`;
      payload.successMessageText = `${templateId}_success_message_text`;
      payload.conditions = {};

      (missions || []).forEach(mission => {
        const missionId = this.getMissionId(mission);
        if (missionId) {
          payload.conditions[missionId] = CustomQuestsTransformer.getLocaleValue(mission.message, localeName);
        } else {
          Logger.warning(`=> Custom Quests: unkown mission type '${mission.type}'`)
        }
      })

      if (!result[localeName]) {
        result[localeName] = { quest: {}, mail: {} };
      }

      result[localeName].quest = payload;
      result[localeName].mail[payload.description] = CustomQuestsTransformer.getLocaleValue(description, localeName);
      result[localeName].mail[payload.successMessageText] = CustomQuestsTransformer.getLocaleValue(success_message, localeName);
    })

    return result;
  }
}

module.exports = CustomQuestsTransformer;