import type { Item } from "@spt-aki/models/eft/common/tables/IItem";
import type { Reward, Rewards } from "@spt-aki/models/eft/common/tables/IQuest";
import type { QuestRewardType } from "@spt-aki/models/enums/QuestRewardType";

import type {
  CustomQuest,
  QuestRewards,
  StoryItemBuild,
  StoryItemBuildBase,
} from "./customQuests";
import { CustomQuestsTransformer } from "./CustomQuestsTransformer";
import { isNotUndefined } from "./utils";

export class RewardsGenerator {
  constructor(
    private customQuest: CustomQuest,
    private builds: Record<string, StoryItemBuild>
  ) {}

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
      type: "Experience" as QuestRewardType,
    };
  }

  private extractItemsFromBuild(
    id: string,
    item: StoryItemBuildBase,
    parentId?: string,
    slotId?: string
  ): Item[] {
    const attachments = item.attachments;
    const initialItem: Item = { _id: id, _tpl: item.item, parentId, slotId };

    let results = [initialItem];

    if (!attachments) {
      return results;
    }

    Object.keys(attachments).forEach((slotId) => {
      const subItem = attachments[slotId];

      const subResults = this.extractItemsFromBuild(
        `${id}_${slotId}`,
        subItem,
        id,
        slotId
      );

      results = [...results, ...subResults];
    });

    return results;
  }

  private generateBuildItemReward(
    item: StoryItemBuild,
    nb: number,
    idPrefix: string
  ): Reward {
    const idReward = `${this.customQuest.id}_item_reward_${item.id}`;
    const targetId = `${idPrefix}TARGET_${idReward}`;

    const items = this.extractItemsFromBuild(targetId, item);
    const firstItem = items[0];

    if (!firstItem.upd) {
      firstItem.upd = {};
    }

    firstItem.upd.StackObjectsCount = nb;

    return {
      index: 0,
      value: String(nb),
      id: idReward,
      type: "Item" as QuestRewardType,
      target: targetId,
      items,
    };
  }

  private generateItemReward(
    itemId: string,
    nb: number,
    idPrefix: string
  ): Reward {
    if (this.builds[itemId]) {
      return this.generateBuildItemReward(this.builds[itemId], nb, idPrefix);
    }

    const idReward = `${this.customQuest.id}_item_reward_${itemId}`;
    const targetId = `${idPrefix}TARGET_${idReward}`;

    return {
      index: 0,
      value: String(nb),
      id: idReward,
      type: "Item" as QuestRewardType,
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

  private generateReputationReward(givenTraderId: string, nb: number): Reward {
    const traderId = CustomQuestsTransformer.getTraderId(givenTraderId);
    const idReward = `${this.customQuest.id}_reputation_reward_${traderId}`;

    return {
      index: 0,
      value: String(nb),
      id: idReward,
      type: "TraderStanding" as QuestRewardType,
      target: traderId,
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
    const reputations = rewards.traders_reputations ?? {};

    const rewardItems = Object.keys(items);
    const rewardReputations = Object.keys(reputations);

    if (xp > 0) {
      result.push(this.generateXpReward(xp, idPrefix));
    }

    rewardItems.forEach((itemId) => {
      const nb = items[itemId];
      if (typeof nb === "number" && nb > 0) {
        result.push(this.generateItemReward(itemId, nb, idPrefix));
      }
    });

    rewardReputations.forEach((traderId) => {
      const nb = reputations[traderId];
      if (typeof nb === "number" && nb !== 0) {
        result.push(this.generateReputationReward(traderId, nb));
      }
    });

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
    };
  }
}
