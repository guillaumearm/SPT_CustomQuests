const path = require('path');
const crypto = require('crypto');

const FALLBACK_LOCALE = 'en';
const DEFAULT_IMAGE_ID = '5a27cafa86f77424e20615d6';
const DEFAULT_LOCATION = 'any';
const DEFAULT_TYPE = 'Completion';

const ALL_LOCALES = Object.keys(DatabaseServer.tables.locales.global);

const getSHA256 = function (input) {
    return crypto.createHash('sha256').update(input).digest('hex')
}

class RewardsGenerator {
    constructor(customQuest) {
        this.customQuest = customQuest;
    }

    static setRewardsIndexes(rewards) {
        return rewards
            .filter(reward => Boolean(reward))
            .map((reward, index) => {
                return {
                    ...reward,
                    index,
                };
            });
    }

    _generateXpReward(xp) {
        return {
            id: `${this.customQuest.id}_xp_reward`,
            value: String(xp),
            type: 'Experience',
        }
    }

    _generateItemReward(itemId, nb) {
        const idReward = `${this.customQuest.id}_item_reward_${itemId}`;
        const targetId = `TARGET_${idReward}`;

        return {
            value: String(nb),
            id: idReward,
            type: "Item",
            target: targetId,
            items: [
                {
                    "_id": targetId,
                    "_tpl": itemId,
                    "upd": {
                        "StackObjectsCount": nb
                    }
                }
            ]
        }
    }

    _generateStarted() {
        // TODO
        return [];
    }

    _generateSuccess() {
        const result = [];
        const rewards = this.customQuest.rewards;

        if (!rewards) {
            return result;
        }

        const { xp, items } = rewards;

        const rewardItems = Object.keys(items || {});

        if (xp > 0) {
            result.push(this._generateXpReward(xp));
        }

        if (rewardItems.length > 0) {
            rewardItems.forEach(itemId => {
                const nb = items[itemId];
                if (typeof nb === 'number' && nb > 0) {
                    result.push(this._generateItemReward(itemId, nb))
                }
            })
        }


        return result;
    }

    _generateFail() {
        // TODO
        return [];
    }

    generateRewards() {
        return {
            Started: this._generateStarted(),
            Success: this._generateSuccess(),
            Fail: this._generateFail(),
        }
    }
}

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
        const killConditionId = getSHA256(JSON.stringify([count, killType, locations, this.customQuest.id]));

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

        const id = getSHA256(JSON.stringify([items, count, fir, this.customQuest.id]));

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

                Logger.warning(`CustomQuests: ignored mission with type '${mission.type}'`)

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
            return getSHA256(JSON.stringify([mission.count, mission.target, mission.locations, this.customQuest.id]));
        } else if (mission.type === 'GiveItem') {
            return getSHA256(JSON.stringify([mission.accepted_items, mission.count, mission.found_in_raid_only, this.customQuest.id]));
        }
        return null;
    }

    generateLocales(generatedQuest) {
        const { name, description, success_message, missions } = this.customQuest;
        const { location, templateId } = generatedQuest;

        const result = {};

        ALL_LOCALES.forEach(localeName => {
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

class QuestsGenerator {
    constructor(story) {
        this.story = story;
    }

    assertValidCustomQuest(customQuest) {
        if (typeof customQuest.id !== 'string') {
            throw new Error('CustomQuests: invalid quest, no id found');
        }
        if (typeof customQuest.trader_id !== 'string') {
            throw new Error('CustomQuests: invalid quest, no trader_id found');
        }
    }

    generateWithLocales() {
        const result = [];
        let previousQuestId = null;

        this.story.forEach(customQuest => {
            if (customQuest.disabled) {
                Logger.warning(`Custom Quests: quest '${customQuest.id}' is disabled`)
            } else {
                this.assertValidCustomQuest(customQuest);
                const transformer = new CustomQuestsTransformer(customQuest, previousQuestId);

                const generatedQuest = transformer.generateQuest()
                const payload = [generatedQuest, transformer.generateLocales(generatedQuest)];
                result.push(payload);

                previousQuestId = customQuest.id;
            }
        });

        return result;
    }
}

class QuestsLoader {
    constructor(questDirectory) {
        this.questDirectory = questDirectory;
    }

    loadAll() {
        VFS.getFiles(this.questDirectory)
            .forEach(fileName => this._loadFile(fileName));
    }

    _loadQuest(quest) {
        const quests = DatabaseServer.tables.templates.quests;

        if (quests[quest._id]) {
            Logger.error(`Custom Quests: already registered questId '${quest._id}'`);
        } else {
            quests[quest._id] = quest;
        }
    }

    _loadLocales(questId, localesPayloads) {
        ALL_LOCALES.forEach(localeName => {
            const payload = localesPayloads[localeName];
            const globalLocales = DatabaseServer.tables.locales.global[localeName];

            if (globalLocales.quest[questId]) {
                Logger.error(`Custom Quests: already registered locales for questId '${quest._id}'`);
            } else {
                globalLocales.quest[questId] = payload.quest;
            }

            Object.keys(payload.mail).forEach(mailId => {
                if (globalLocales.mail[mailId]) {
                    Logger.error(`Custom Quests: already registered mail '${mailId}' for questId '${quest._id}'`);
                } else {
                    globalLocales.mail[mailId] = payload.mail[mailId];
                }
            })
        })
    }

    _loadFile(fileName) {
        const fullPath = path.join(this.questDirectory, fileName);

        const storyOrQuest = require(fullPath);
        const story = storyOrQuest.id ? [storyOrQuest] : storyOrQuest;

        const questGen = new QuestsGenerator(story);

        // array of tuple [quest, questLocales]
        const questsPayloads = questGen.generateWithLocales();

        questsPayloads.forEach(([quest, questLocales]) => {
            this._loadQuest(quest);
            this._loadLocales(quest._id, questLocales);
        })
    }
}

module.exports = QuestsLoader;