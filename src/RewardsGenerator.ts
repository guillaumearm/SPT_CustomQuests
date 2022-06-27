import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import type { Reward, Rewards } from "@spt-aki/models/eft/common/tables/IQuest";

import {
  CustomQuest,
  QuestRewards,
  StoryItemBuild,
  StoryItemBuildBase,
} from "./customQuests";
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
      type: "Experience",
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
      type: "Item",
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
    };
  }
}
