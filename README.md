# Custom Quests
Easy quests creation tool for [SPT-AKI](https://www.sp-tarkov.com/)

Using [Custom Quests Editor](https://hub.sp-tarkov.com/files/file/525-custom-quests-editor/) will help you A LOT to create and edit json quests files.

[API Documentation - How to create quests](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/USAGE_MANUAL.md) (manually)

## Description
This mod allow to add your own quests easily with a single json file (per quest).

## Features
- [Online App: Custom Quests Editor](https://hub.sp-tarkov.com/files/file/525-custom-quests-editor/)
- Create a custom quest with a single json file
- Quest chaining
- Several mission types available: `Kill`, `GiveItem`, `FindItem`, `PlaceItem`, `PlaceBeacon`, `PlaceSignalJammer`, `VisitPlace`
- `GiveItem`, `FindItem` and `PlaceItem` missions are compatible with [quest items](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/ALL_QUEST_ITEMS.md)
- Rewards: xp and items (with attachements using `@build` directive) on quest success or quest start
- Group items ids using `@group` directive (valable for `accepted_items` fields only)
- Compatible with modded traders
- Multilingual
- Options to wipe custom quests progression from profile (useful during the development)

## Usage
Place your json files in the `quests` directory.

Sub-directories can be used to organize your quest files.

So these are valid:
- quests/my_first_quest.json
- quests/my_quests/my_first_quest.json

Please read [the usage manual](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/USAGE_MANUAL.md) to get more infos on how to create your own quests.

Check [the examples](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/EXAMPLES.md) can help too.

You can rename the folder `examples.disabled` in `examples` to try out the examples ;-)

## Global configuration
- `enabled`: allow to enable or not CustomQuests mod
- `debug`: more verbose console
- `quest_directory`: The directory with custom quests
- `at_start.disable_all_vanilla_quests`: Disable all vanilla quests (this will unlock Jaeger but without editing your profile)
- `at_start.wipe_enabled_custom_quests_state_from_all_profiles`: wipe all enabled custom quests from all profiles

## Resources
- [All zones](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/ALL_ZONES.md)
- [All places](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/ALL_PLACES.md)
- [All quest items](https://github.com/guillaumearm/aki_CustomQuests/blob/master/docs/ALL_QUEST_ITEMS.md)

## Modding API
You can inject custom quests dynamically from other mods.

In the `delayedLoad` method:

```js
const myExampleQuest = {
  id: "trap_quest_example_1_with_api",
  trader_id: "mechanic",
  name: "My first quest",
  description: "My first quest description",
  success_message: "My success message",
};

// call this in `delayedLoad` method
const injectQuests = () => {
  if (!globalThis.CustomQuestsAPI) {
    Logger.error(`CustomQuestsAPI not found, are you sure a version of CustomQuests >= 2.2.0 is installed ?`);
    return;
  }

  globalThis.CustomQuestsAPI.load([myExampleQuests]);
}
```

#### Typescript support
The `CustomQuestsAPI.load` method take an array of [`StoryItem`](https://github.com/guillaumearm/aki_CustomQuests/blob/master/src/mod.ts#L23) in parameter.

Check the [`CustomQuestsAPI` type definition](https://github.com/guillaumearm/aki_CustomQuests/blob/master/src/mod.ts#L23) for more details.


## Planned features
- New mission type: `SurviveRaid`
- More rewards: trader reputation, unlock traders, unlock barters
- More kill targets: bosses, raiders, rogues.
- Failure quests: this allow to create several path in your story
- Rewards on fail
- Repeatable quests (not daily quests)
- Custom quest images
- Mission type `Kill` improvements: weapon restrictions, equipment restrictions
- Mission type `Kill` improvements: range restrictions, physical effects restrictions
- Mission restriction: only on night
- New mission type: `GunSmith`
- New mission type: `TraderLoyalty`
- New mission type: `Skill`

If you have some ideas to improve the mod, you can create an issue on github (or comment on the hub) ;-)

## The original README

[The original readme file](https://github.com/guillaumearm/aki_CustomQuests/blob/master/README.md) is available on github.
