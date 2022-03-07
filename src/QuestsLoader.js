const path = require('path');

const utils = require('./utils');
const QuestsGenerator = require('./QuestsGenerator');

class QuestsLoader {
    constructor(questDirectory) {
        this.questDirectory = questDirectory;
    }

    loadAll() {
        let loadedQuests = [];

        VFS.getFiles(this.questDirectory)
            .forEach(fileName => {
                const quests = this._loadFile(fileName);
                loadedQuests = [...loadedQuests, ...quests];
            });

        return loadedQuests;
    }

    _loadQuest(quest) {
        const quests = DatabaseServer.tables.templates.quests;

        if (quests[quest._id]) {
            Logger.error(`=> Custom Quests: already registered questId '${quest._id}'`);
        } else {
            quests[quest._id] = quest;
        }
    }

    _loadLocales(questId, localesPayloads) {
        utils.ALL_LOCALES.forEach(localeName => {
            const payload = localesPayloads[localeName];
            const globalLocales = DatabaseServer.tables.locales.global[localeName];

            if (globalLocales.quest[questId]) {
                Logger.error(`=> Custom Quests: already registered locales for questId '${quest._id}'`);
            } else {
                globalLocales.quest[questId] = payload.quest;
            }

            Object.keys(payload.mail).forEach(mailId => {
                if (globalLocales.mail[mailId]) {
                    Logger.error(`=> Custom Quests: already registered mail '${mailId}' for questId '${quest._id}'`);
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

        return questsPayloads.map(([quest, questLocales]) => {
            this._loadQuest(quest);
            this._loadLocales(quest._id, questLocales);

            return quest;
        });
    }
}

module.exports = QuestsLoader;