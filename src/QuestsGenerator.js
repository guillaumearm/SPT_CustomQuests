const CustomQuestsTransformer = require('./CustomQuestsTransformer');

class QuestsGenerator {
  constructor(story) {
    this.story = story;
  }

  assertValidCustomQuest(customQuest) {
    if (typeof customQuest.id !== 'string') {
      throw new Error('=> CustomQuests: invalid quest, no id found');
    }
    if (typeof customQuest.trader_id !== 'string') {
      throw new Error('=> CustomQuests: invalid quest, no trader_id found');
    }
  }

  generateWithLocales() {
    const result = [];
    let previousQuestId = null;

    this.story.forEach(customQuest => {
      if (customQuest.disabled) {
        Logger.warning(`=> Custom Quests: quest '${customQuest.id}' is disabled`)
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

module.exports = QuestsGenerator