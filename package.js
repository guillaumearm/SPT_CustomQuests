"use strict";

const path = require('path');

const QuestsLoader = require('./src/QuestsLoader');

const DEFAULT_QUESTS_DIR = "quests";

class CustomQuests {
    constructor() {
        const mod = require("./package.json")
        const config = require('./config/config.json');

        this.config = config;
        this.questDirectory = path.join(__dirname, config.quest_directory || DEFAULT_QUESTS_DIR);

        if (!config.enabled) {
            Logger.warning(`=> Custom Quests: disabled from the config file`);
            return;
        }

        Logger.info(`Loading: Custom Quests v${mod.version}`);

        ModLoader.onLoad[mod.name] = this.onLoad.bind(this);
    }


    onLoad() {
        const questsLoader = new QuestsLoader(this.questDirectory);
        const nbLoadedQuests = questsLoader.loadAll();
        Logger.success(`=> Custom Quests: ${nbLoadedQuests} quests loaded`)
    }
}

module.exports = new CustomQuests();