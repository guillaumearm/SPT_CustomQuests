const fs = require("fs");
const path = require("path");

const DISABLED_PREFIX = ".disabled";
const DIST_QUESTS_FOLDER = "dist/quests";

const main = async () => {
  const cwd = process.cwd();
  const questsPath = path.join(cwd, DIST_QUESTS_FOLDER);

  // could be directory too
  const fileNames = fs.readdirSync(questsPath);

  fileNames.forEach((fileName) => {
    if (!fileName.endsWith(DISABLED_PREFIX)) {
      fs.rmSync(path.join(questsPath, fileName), {
        recursive: true,
        force: true,
      });
    }
  });
};

main();
