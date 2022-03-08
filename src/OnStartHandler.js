const ALL_VANILLA_QUESTS = require('./allVanillaQuestIds');

class OnStartHandler {
  constructor(config) {
    this.config = config
    this.onStartConfig = config.at_start || {};
  }

  _disableVanillaQuests() {
    const nbQuests = ALL_VANILLA_QUESTS.length;

    const templates = DatabaseServer.tables.templates

    ALL_VANILLA_QUESTS.forEach(questId => {
      delete templates.quests[questId];
    })

    Logger.info(`=> Custom Quests: ${nbQuests} vanilla quests removed`);
  }

  _wipeProfilesForQuest(questId) {
    let nbWiped = 0;
    const profileIds = Object.keys(SaveServer.profiles);

    profileIds.forEach(profileId => {
      const profile = SaveServer.profiles[profileId];
      const pmcData = profile && profile.characters && profile.characters.pmc
      const dialogues = profile.dialogues || {};

      if (pmcData) {
        // 1. wipe quests
        const Quests = pmcData.Quests.filter(q => q.qid !== questId);
        const questRemoved = Quests.length !== pmcData.Quests.length;

        pmcData.Quests = Quests;

        // 2. wipe backend counters
        if (!pmcData.BackendCounters) {
          pmcData.BackendCounters = {};
        }

        let backendCounterRemoved = false;
        const backendCounters = pmcData.BackendCounters;
        Object.keys(backendCounters).forEach(counterId => {
          const counter = backendCounters[counterId];

          if (counter && counter.qid === questId) {
            backendCounterRemoved = true;
            delete pmcData.BackendCounters[counterId];
          }
        });

        if (questRemoved || backendCounterRemoved) {
          nbWiped += 1;
        }
      }

      // 3. wipe dialogues
      Object.keys(dialogues).forEach(dialogId => {
        const dialogue = dialogues[dialogId] || {};
        const messages = dialogue.messages || [];
        dialogue.messages = messages.filter(msg => msg.templateId !== `${questId}_description` && msg.templateId !== `${questId}_success_message_text`)
      });
    });

    if (nbWiped > 0) {
      Logger.info(`=> Custom Quests: wiped ${nbWiped} profile${nbWiped > 1 ? 's' : ''} for quest '${questId}'`);
    }
  }

  beforeCustomQuestsLoaded() {
    if (this.onStartConfig.disable_all_vanilla_quests) {
      this._disableVanillaQuests();
    }
  }

  afterCustomQuestsLoaded(loadedQuests) {
    SaveServer.load();

    loadedQuests.forEach(quest => {
      if (this.onStartConfig.wipe_enabled_custom_quests_state_from_all_profiles && !quest.disabled) {
        this._wipeProfilesForQuest(quest._id);
      } else if (this.onStartConfig.wipe_disabled_custom_quests_state_from_all_profiles && quest.disabled) {
        this._wipeProfilesForQuest(quest._id);
      }
    });

    SaveServer.save();
  }
}

module.exports = OnStartHandler