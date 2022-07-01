const config = require("../dist/config/config.json");

if (
  config.at_start &&
  config.at_start.wipe_enabled_custom_quests_state_from_all_profiles === true
) {
  console.error(
    `Error: 'wipe_enabled_custom_quests_state_from_all_profiles' is 'true' and should be set to 'false' for the release`
  );
  process.exit(1);
}
