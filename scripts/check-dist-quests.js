const fs = require("fs");
const path = require("path");

const DISABLED_PREFIX = ".disabled";
const DIST_QUESTS_FOLDER = "dist/quests";

const main = async () => {
  const cwd = process.cwd();
  const questsPath = path.join(cwd, DIST_QUESTS_FOLDER);

  // could be directory too
  const fileNames = fs.readdirSync(questsPath);

  const errors = [];

  fileNames.forEach((fileName) => {
    if (!fileName.endsWith(DISABLED_PREFIX)) {
      errors.push(
        new Error(
          `'${DIST_QUESTS_FOLDER}/${fileName}' does not end with '${DISABLED_PREFIX}'`
        )
      );
    }
  });

  errors.forEach((err) => {
    console.error(`${err}`);
  });

  if (errors.length) {
    process.exit(1);
  }
};

main();
