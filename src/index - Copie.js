const DEFAULT_IMAGE_ID = '5a27cafa86f77424e20615d6';

const createCustomQuest = (qid, name, description, successMessage, conditions = {}, rewards = {}) => {
    const database = DatabaseServer.tables;


    const quest = createQuest(qid, conditions, rewards);
    database.templates.quests[quest._id] = quest;

    const questLocales = createQuestLocales(qid, name, description, successMessage);

    const en = database.locales.global.en;

    en.mail = { ...en.mail, ...questLocales.mail };
    en.quest = { ...en.quest, ...questLocales.quest };

    const fr = database.locales.global.fr;
    fr.mail = { ...fr.mail, ...questLocales.mail };
    fr.quest = { ...fr.quest, ...questLocales.quest };
}

function createQuest(questId, conditions = {}, rewards = {}) {
    // TODO image
    const image = `/files/quest/icon/${DEFAULT_IMAGE_ID}.jpg`

    return {
        "QuestName": questId,
        "_id": questId,
        "canShowNotificationsInGame": true,
        "conditions": {
            "AvailableForFinish": conditions.AvailableForFinish || [],
            "AvailableForStart": conditions.AvailableForStart || [],
            "Fail": conditions.Fail || []
        },
        "description": `${questId} description`,
        "failMessageText": `${questId} failMessageText`,
        "name": `${questId} name`,
        "note": `${questId} note`,
        "traderId": "5a7c2eca46aef81a7ca2145d",
        "location": "any",
        "image": image,
        "type": "PickUp",
        "isKey": false,
        "restartable": false,
        "instantComplete": false,
        "secretQuest": false,
        "startedMessageText": `${questId} startedMessageText`,
        "successMessageText": `${questId} successMessageText`,
        "templateId": questId,
        "rewards": {
            "Started": rewards.Started || [],
            "Success": rewards.Success || [],
            "Fail": rewards.Fail || []
        }
    };
}

function createQuestLocales(questId, questName, questDescription, questSuccess) {
    const questDescriptionId = `${questId}_description`;
    const questSuccessId = `${questId}_success`;

    return {
        quest: {
            [questId]: {
                "conditions": {
                    my_condition_id_1: "Find 2 afak",
                },
                "name": questName,
                "description": questDescriptionId,
                "note": "",
                "failMessageText": "",
                "startedMessageText": "",
                "successMessageText": questSuccessId,
                "location": "any"
            }
        },
        mail: {
            [questDescriptionId]: questDescription,
            [questSuccessId]: questSuccess,
        }
    };

}

class CustomQuests {
    constructor() {
        const mod = require("./package.json")
        const config = require('./config/config.json');

        if (!config.enabled) {
            Logger.warning(`=> ${mod.name}: disabled from the config file`);
            return;
        }

        Logger.info(`Loading: ${mod.name} v${mod.version}`);

        ModLoader.onLoad[mod.name] = this.onLoad.bind(this);
    }


    onLoad() {

        const conditions = {
            AvailableForFinish: [{
                "_parent": "HandoverItem",
                "_props": {
                    "dogtagLevel": 0,
                    "id": "my_condition_id_1",
                    "index": 0,
                    "maxDurability": 100,
                    "minDurability": 0,
                    "parentId": "",
                    "onlyFoundInRaid": true,
                    "dynamicLocale": false,
                    "target": [
                        "590c678286f77426c9660122",
                        "544fb45d4bdc2dee738b4568",
                        "590c661e86f7741e566b646a"
                    ],
                    "value": "2",
                    "visibilityConditions": []
                },
                "dynamicLocale": false
            }]
        }


        // createCustomQuest('trap_quest_1', 'my quest name 1', 'my description 1', 'my success message 1', conditions);
        // createCustomQuest('trap_quest_2', 'my quest name 2', 'my description 2', 'my success message 2');
        // createCustomQuest('trap_quest_3', 'my quest name 3', 'my description 3', 'my success message 3');
        // createCustomQuest('trap_quest_4', 'my quest name 4', 'my description 4', 'my success message 4');

        Logger.success('=> CustomQuests: loaded');
    }
}

module.exports = CustomQuests;