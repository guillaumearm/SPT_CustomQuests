# Custom Quests
Easy quests creation tool for [SPT-AKI](https://www.sp-tarkov.com/)

## Description
This mod allow to add your own quests easily with a single json file (per quest).

Also, there is a chaining feature that allow you to create a chain of quest in a single json file.
Please read the tutorial and/or take a look to the examples directory for more details.

## Features
- Create a custom quest with a single json file
- Quest chaining
- Several mission types available: `Kill`, `GiveItem`, `PlaceItem`, `PlaceBeacon`, `PlaceSignalJammer`, `VisitPlace`
- Rewards: xp and items on quest success
- Compatible with modded traders
- Multilingual

## Full documentation
Please read [the usage manual](./docs/USAGE_MANUAL.md) to get more infos on how to create your own quests ;-)

## Global configuration
- `enabled`: allow to enable or not CustomQuests mod
- `quest_directory`: The directory with custom quests
- `at_start.disable_all_vanilla_quests`: Disable all vanilla quests and unlock Jaeger
- `at_start.wipe_enabled_custom_quests_state_from_all_profiles`: wipe all enabled custom quests for all profiles
- `at_start.wipe_enabled_custom_quests_state_from_all_profiles`: wipe all disabled custom quests for all profiles

## Resources
- [All zones](./docs/ALL_ZONES.md)
- [All places](./docs/ALL_PLACES.md)

## Planned features
- Rewards on start: give items/xp when start a quest
- More rewards: trader reputation, unlock traders, unlock barters
- Failure quests: this allow to create several path in your story
- Repeatable quests (not daily quests)
- Custom quest image
- Mission type `Kill` improvements: weapon restrictions, equipment restrictions
- Mission restriction: only on night

If you have some ideas to improve the mod, you can create an issue on github (or comment on the hub) ;-)
