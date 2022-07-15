# Custom Quests API - How to create quests

## Summary
- [A minimal example](#a-minimal-example)
- [A minimal example (recommended)](#a-minimal-example-recommended)
- [Multilingual support](#multilingual-support)
- [Decoration only](#decoration-only)
- [Chained quests](#chained-quests)
- [Quests rewards](#rewards)
- [Rewards on quest start](#rewards-on-quest-start)
- [Repeatable quests](#repeatable-quests)
- [Missions](#missions)
  - [Kill](#kill)
  - [GiveItem](#giveitem)
  - [FindItem](#finditem)
  - [PlaceItem](#placeitem)
  - [PlaceBeacon / PlaceSignalJammer](#placebeacon-and-placesignaljammer)
  - [VisitPlace](#visitplace)
- [Special directives](#special-directives)
  - [@group](#group-directive)
  - [@build](#build-directive)
## A minimal example
```json
{
  "id": "trap_quest_example_1",
  "trader_id": "mechanic"
}
```

- `id`: is mandatory and should be unique, it allows you to identity your quest.
- `trader_id`: could be a regular id (like `579dc571d53a0658a154fbec`) or an alias (please see the list just below).

#### Available trader aliases
- `prapor`
- `therapist`
- `fence`
- `skier`
- `peacekeeper`
- `mechanic`
- `ragman`
- `jaeger`

Modded traders are supported too.

## A minimal example (recommended)
```json
{
  "id": "trap_quest_example_1_bis",
  "disabled": false,
  "trader_id": "mechanic",
  "name": "My first quest",
  "description": "My first quest description",
  "success_message": "My success message"
}
```

It's recommended to always use `name`, `description` and `success_message` to prevent empty messages in the game.

The `disabled` field is not mandatory but can be useful when quests are under development, it just doesn't load the concerned quest.

## Multilingual support
```json
{
  "id": "trap_quest_example_2",
  "trader_id": "mechanic",
  "name": {
    "en": "My second quest",
    "fr": "Ma seconde quete"
  },
  "description": {
    "en": "My quest description",
    "fr": "Ma description de quete"
  },
  "success_message": {
    "en": "My success message",
    "fr": "Mon message de succes"
  }
}
```

Some fields are translatable, these are all available locales:

- `ch`
- `cz`
- `en` (Default when not found)
- `es`
- `es-mx`
- `fr`
- `ge`
- `hu`
- `it`
- `jp`
- `kr`
- `pl`
- `po`
- `ru`
- `sk`
- `tu`

## Decoration only
```json
{
  "id": "trap_quest_example_3",
  "trader_id": "mechanic",
  "name": "My third quest",
  "description": "My third quest description",
  "success_message": "My success message",
  "descriptive_location": "interchange",
  "type": "Completion",
  "image": "5a29222486f77456f50d09e7"
}
```

These fiels are not mandatory and are for quest decoration only:

- `name` (empty by default)
- `description` (empty by default)
- `success_message` (empty by default)
- `descriptive_location` (`any` by default)
- `type` (`Completion` by default)
- `image` (`5a27cafa86f77424e20615d6` by default)

#### all descriptive_location
- `any` (by default)
- `customs` (or `bigmap`)
- `factory`
- `interchange`
- `labs` (or `laboratory`)
- `lighthouse`
- `reserve` (or `rezervbase`)
- `shoreline`
- `woods`

#### all type
- `Completion`
- `PickUp`
- `Elimination`
- `Loyalty`
- `Discover`

These are just for decoration purpose, please read above for more infos about Missions.

#### all images
You can found all quests images in `Aki_Data/Server/images/quests/` directory.

## Chained quests

#### Quest visibility conditions

```json
{
    "id": "trap_quest_example_4",
    "trader_id": "mechanic",
    "name": "My fourth quest",
    "description": "My fourth quest description",
    "success_message": "My success message",
    "level_needed": 10,
    "locked_by_quests": [
      "trap_quest_example_1",
      "trap_quest_example_1_bis"
    ],
    "unlock_on_quest_start": []
}
```

To be able to see this quest, your pmc should be at least level 10 + the `trap_quest_example_1` and `trap_quest_example_1_bis` quests should have been completed.

Also, you can use the `unlock_on_quest_start` array to specify which quests has to been started to unlock this quest.

## Rewards
This quest will give you +5000 xp, 2 ai-2 kits, 1 car first aid kit and give +0.25 loyalty to prapor and mechanic.

```json
{
  "id": "trap_quest_example_5",
  "trader_id": "mechanic",
  "name": "My rewards quest",
  "description": "Complete this quest and I will give you something",
  "success_message": "Bravo!",
  "rewards": {
    "xp": 5000,
    "items": {
      "5755356824597772cb798962": 2,
      "590c661e86f7741e566b646a": 1
    },
    "traders_reputations": {
      "mechanic": 0.25,
      "prapor": 0.25
    }
  }
}
```

- `xp`: The amount of gained xp
- `items`: The obtained items and their amount

pro-tip: You can use [this tool](https://db.sp-tarkov.com/search) to find item ids.

## Rewards on quest start
This quest give you +100 xp and 1 car first aid kit.
```json
{
  "id": "trap_quest_example_5_start_rewards",
  "trader_id": "mechanic",
  "name": "My rewards quest",
  "description": "Complete this quest and I will give you something",
  "success_message": "Bravo!",
  "start_rewards": {
    "xp": 5000,
    "items": {
      "5755356824597772cb798962": 2,
      "590c661e86f7741e566b646a": 1
    }
  }
}
```

## Repeatable quests
You can setup "infinite" repeatable quests like so:

```json
  {
    "id": "trap_example_simple_repeatable_quest",
    "repeatable": true,
    "trader_id": "fence",
    "name": {
      "en": "My first quest"
    },
    "description": {
      "en": "My description"
    },
    "success_message": {
      "en": "It works!"
    },
    "rewards": {
      "xp": 10,
      "items": {
        "5449016a4bdc2d6f028b456f": 100
      }
    }
  }
```

Limitation: you can repeat the same quest 1000 times per game, this means you have to restart the game once you repeated too much time the same quest (1000 seems enough for me but you can change this in the config)

## Missions
A quest can have several missions.

This is an example mission where you have to kill 5 scavs on customs or factory.

Completing this quest will give you 1 000 000 roubles ;-)

```json
{
  "id": "trap_quest_example_6",
  "trader_id": "mechanic",
  "name": "First mission",
  "description": "Kill 5 scavs on customs or factory and I will make you rich",
  "success_message": "Bravo!",
  "missions": [
    {
      "type": "Kill",
      "target": "Savage",
      "locations": [
        "customs",
        "factory"
      ],
      "count": 5,
      "message": "Kill 5 scavs on customs or factory"
    }
  ],
  "rewards": {
    "items": {
      "5449016a4bdc2d6f028b456f": 1000000
    }
  }
}
```

## Type of missions
### Kill
The player has to kill bots

A `Kill` mission payload example: 
```json
{
  "type": "Kill",
  "target": "Savage",
  "locations": [
    "customs",
    "factory"
  ],
  "count": 5,
  "message": "Kill 5 scavs on customs or factory with a 'Chiappa Rhino 50DS .357 revolver'",
  "weapons_whitelist": ["61a4c8884f95bc3b2c5dc96f"]
}
```

The `target` field:
- `Any` for any kills (default value)
- `Savage` for scav kills
- `AnyPmc` for bear or usec kills
- `Usec` for usec kills
- `Bear` for bear kills

The `locations` array possible values are:
- `customs` (or `bigmap`)
- `factory` (for night AND day)
- `factory4_day` (day only)
- `factory4_night` (night only)
- `interchange`
- `labs` (or `laboratory`)
- `lighthouse`
- `reserve` (or `rezervbase`)
- `shoreline`
- `woods`

The `count` is the number of kills needed to complete the mission (default to 1).

The `weapons_whitelist` is an array of ids (compatible with [@group directives](#group-directive))

The `message` is the message quest, it's available on all type of missions and support multilingual format.

The `one_session_only` means the kill counter will be reset at the end of the raid. (`false` by default)

### GiveItem
The player has to give specific item to a trader.
This mission type is compatible with [quest items](./ALL_QUEST_ITEMS.md) for `accepted_items`

A `GiveItem` mission payload example:
```json
{
  "type": "GiveItem",
  "accepted_items": [
    "590c661e86f7741e566b646a"
  ],
  "count": 2,
  "found_in_raid_only": true,
  "message": {
    "en": "Give me 2 car first aid kits"
  }
}
```

`accepted_items` is an array of item ids accepted for the quest.

pro-tips:
  - You can use [this tool](https://db.sp-tarkov.com/search) to find item ids.
  - [Quest items](./ALL_QUEST_ITEMS.md) can be used
  - You can use a [`@group`](#group-directive) id on `accepted_items` fields.

`count` is the number of item you have to provide to complete the mission (default to 1).

`found_in_raid_only` is false by default and means the item you give should be marked as FIR (found in raid).

`message` is the usual mission message.

### FindItem
The player has to find a specific item during the raid.

This mission type is compatible with [quest items](./ALL_QUEST_ITEMS.md) for `accepted_items`

A `FindItem` mission payload example:
```json
{
  "type": "FindItem",
  "accepted_items": ["591093bb86f7747caa7bb2ee"],
  "message": "Give me 2 car first aid kits"
}
```

`accepted_items` is an array of item ids accepted for the quest.

pro-tips:
  - You can use [this tool](https://db.sp-tarkov.com/search) to find item ids.
  - [Quest items](./ALL_QUEST_ITEMS.md) can be used
  - You can use a [`@group`](#group-directive) id on `accepted_items` fields.

`count` is the number of item you have to provide to complete the mission (default to 1).

`message` is the usual mission message.

### PlaceItem
The player has to place an item at a specific place during the raid.
```json
{
  "type": "PlaceItem",
  "zone_id": "case_extraction",
  "accepted_items": [
    "5755356824597772cb798962"
  ],
  "plant_time": 2,
  "need_survive": {
    "en": "Need to survive the raid"
  },
  "message": {
    "en": "Place the ai-2 where you know"
  },
}
```

`zone_id`: all zones can be found [here](./ALL_ZONES.md)

`accepted_items` is an array of item ids accepted for the quest.

pro-tips:
  - You can use [this tool](https://db.sp-tarkov.com/search) to find item ids.
  - [Quest items](./ALL_QUEST_ITEMS.md) can be used
  - You can use a [`@group`](#group-directive) id on `accepted_items` fields.

`plant_time` is the time in second the player has to press the `f` key to place the item.

`need_survive`: if set, the player has to survive the raid to complete the mission, the message is displayed in the interface conditionally (when the item has been placed)

`message` is the usual mission message.

`one_session_only` means the counter will be reset at the end of the raid. (`false` by default)

### PlaceBeacon and PlaceSignalJammer
The player has to place a beacon (or a signal jammer) at a specific place during the raid.
```json
{
  "type": "PlaceBeacon",
  "zone_id": "case_extraction",
  "plant_time": 10,
  "need_survive": {
    "en": "Need to survive the raid"
  },
  "message": {
    "en": "Place the ai-2 where you know"
  },
}
```

Same properties as `PlaceItem` except there is no `accepted_items` field here.

Please note you can change the `type` to be `PlaceSignalJammer` instead.

### VisitPlace
The player has to visit a place during the raid.


```json
{
  "type": "VisitPlace",
  "place_id": "gazel",
  "need_survive": {
    "en": "Need to survive the raid on the concerned map"
  },
  "message": "visit the place you know ;-)"
}
```

`place_id`: all places can be found [here](./ALL_PLACES.md)

Warning: [Places](./ALL_PLACES.md) are not [Zones](./ALL_ZONES.md).

`need_survive`: if set, the player has to survive the raid to complete the mission, the message is displayed in the interface conditionally (when the place has been discovered)

`message` is the usual mission message.

`one_session_only` means the counter will be reset at the end of the raid. (`false` by default)

## Special directives
There exists special commands called `directives` in CustomQuests to help with qwuest creation.

Currently, there is 2 commands: `@group` and `@build`.

A directive is a special payload with `type` field (can only be `@group` or `@build` for now), it lives with the quests and do not need to respect any order.

### group directive
With the `@group` directive, you can define a group of items with a special id you can re-use in all `accepted_items` field as well as for `weapons_whitelist` option in [Kill](#kill) missions.

This simply the quest workflow creation when having a lot of `accepted_items`.

For example:

```json
[
  {
    "type": "@group",
    "id": "meds",
    "items": [
      "5755356824597772cb798962",
      "5b4335ba86f7744d2837a264",
      "5d1b3a5d86f774252167ba22",
      "619cc01e0a7c3a1a2731940c",
      "544fb45d4bdc2dee738b4568",
      "590c678286f77426c9660122",
      "60098ad7c2240c0fe85c570a",
      "590c661e86f7741e566b646a",
      "544fb37f4bdc2dee738b4567",
      "590c695186f7741e566b64a2",
      "5af0548586f7743a532b7e99",
      "544fb25a4bdc2dfb738b4567",
      "5751a25924597722c463c472",
      "544fb3364bdc2d34748b456a",
      "5af0454c86f7746bf20992e8",
      "5751a89d24597722aa0e8db0",
      "5755383e24597772cb798966",
      "5e831507ea0a7c419c2f9bd9",
      "60098af40accd37ef2175f27",
      "5d02778e86f774203e7dedbe",
      "5e8488fa988a8701445df1e4",
      "590c657e86f77412b013051d",
      "544fb3f34bdc2d03748b456a",
      "5c10c8fd86f7743d7d706df3"
    ]
  },
  {
    "id": "trap_therapist_meds_1",
    "trader_id": "therapist",
    "name": {
      "en": "More meds part 1"
    },
    "success_message": {
      "en": "Congrats, here is your reward"
    },
    "description": {
      "en": "We need meds"
    },
    "type": "PickUp",
    "missions": [
      {
        "type": "GiveItem",
        "accepted_items": ["meds"],
        "found_in_raid_only": false,
        "count": 1,
        "message": {
          "en": "Give me any meds"
        }
      }
    ]
  },
]
```

### build directive
With the `@build` directive, you can simply define a weapon build (or any item with attachments)

For example: (TODO)

```json
[
  {
    "type": "@build",
    "id": "my_first_colt_build",
    "item": "5447a9cd4bdc2dbd208b4567",
    "attachments": {
      "mod_reciever": {
        "item": "5c0e2f26d174af02a9625114",
        "attachments": {
          "mod_scope": {
            "item": "57ac965c24597706be5f975c"
          },
          "mod_barrel": {
            "item": "55d35ee94bdc2d61338b4568",
            "attachments": {
              "mod_gas_block": {
                "item": "5ae30e795acfc408fb139a0b"
              }
            }
          },
          "mod_handguard": {
            "item": "5c0e2f5cd174af02a012cfc9"
          }
        }
      },
      "mod_pistol_grip": {
        "item": "5c0e2ff6d174af02a1659d4a"
      },
      "mod_stock": {
        "item": "5a33ca0fc4a282000d72292f"
      },
      "mod_charge": {
        "item": "5c0faf68d174af02a96260b8"
      }
    }
  },
  {
    "id": "trap_example_quest_item_build_rewards",
    "trader_id": "fence",
    "name": {
      "en": "2 new weapons!"
    },
    "description": {
      "en": "Complete the quest to get 2 colts"
    },
    "success_message": {
      "en": "Bravo!"
    },
    "rewards": {
      "xp": 500,
      "items": {
        "my_first_colt_build": 2
      }
    }
  }
]
```
