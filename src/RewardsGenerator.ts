import type { Reward, Rewards } from "@spt-aki/models/eft/common/tables/IQuest";

import { CustomQuest, QuestRewards } from "./customQuests";
import { isNotUndefined } from "./utils";

export class RewardsGenerator {
  constructor(private customQuest: CustomQuest) {}

  static setRewardsIndexes(rewards: (Reward | undefined)[]): Reward[] {
    return rewards.filter(isNotUndefined).map((reward, index) => {
      return {
        ...reward,
        index,
      };
    });
  }

  private generateXpReward(xp: number, idPrefix = ""): Reward {
    return {
      index: 0,
      id: `${idPrefix}${this.customQuest.id}_xp_reward`,
      value: String(xp),
      type: "Experience",
    };
  }

  private generateItemReward(
    itemId: string,
    nb: number,
    idPrefix = ""
  ): Reward {
    const idReward = `${this.customQuest.id}_item_reward_${itemId}`;
    const targetId = `${idPrefix}TARGET_${idReward}`;

    return {
      index: 0,
      value: String(nb),
      id: idReward,
      type: "Item",
      target: targetId,
      items: [
        {
          _id: targetId,
          _tpl: itemId,
          upd: {
            StackObjectsCount: nb,
          },
        },
      ],
    };
  }

  private generateRewards(
    getRewards: () => QuestRewards | undefined,
    idPrefix = ""
  ): Reward[] {
    const result: Reward[] = [];
    const rewards = getRewards();

    if (!rewards) {
      return result;
    }

    const xp = rewards.xp ?? 0;
    const items = rewards.items ?? {};

    const rewardItems = Object.keys(items);

    if (xp > 0) {
      result.push(this.generateXpReward(xp, idPrefix));
    }

    if (rewardItems.length > 0) {
      rewardItems.forEach((itemId) => {
        const nb = items[itemId];
        if (typeof nb === "number" && nb > 0) {
          result.push(this.generateItemReward(itemId, nb, idPrefix));
        }
      });
    }

    return result;
  }

  public generateAllRewards(): Rewards {
    return {
      Started: this.generateRewards(
        () => this.customQuest.start_rewards,
        "at_start_"
      ),
      Success: this.generateRewards(() => this.customQuest.rewards, "success_"),
      Fail: [], // TODO
      AvailableForStart: [],
      AvailableForFinish: [],
      FailRestartable: [],
      Expired: [],
    };
  }
}
