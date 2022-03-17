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

  _generateXpReward(xp, idPrefix = '') {
    return {
      id: `${idPrefix}${this.customQuest.id}_xp_reward`,
      value: String(xp),
      type: 'Experience',
    }
  }

  _generateItemReward(itemId, nb, idPrefix = '') {
    const idReward = `${this.customQuest.id}_item_reward_${itemId}`;
    const targetId = `${idPrefix}TARGET_${idReward}`;

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

  _generateRewards(getRewards, idPrefix = '') {
    const result = [];
    const rewards = getRewards();

    if (!rewards) {
      return result;
    }

    const { xp, items } = rewards;

    const rewardItems = Object.keys(items || {});

    if (xp > 0) {
      result.push(this._generateXpReward(xp, idPrefix));
    }

    if (rewardItems.length > 0) {
      rewardItems.forEach(itemId => {
        const nb = items[itemId];
        if (typeof nb === 'number' && nb > 0) {
          result.push(this._generateItemReward(itemId, nb, idPrefix))
        }
      })
    }


    return result;
  }

  generateRewards() {
    return {
      Started: this._generateRewards(() => this.customQuest.start_rewards, 'at_start_'),
      Success: this._generateRewards(() => this.customQuest.rewards, 'success_'),
      Fail: [], // TODO
    }
  }
}

module.exports = RewardsGenerator;