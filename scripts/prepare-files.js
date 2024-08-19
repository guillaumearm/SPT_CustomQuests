// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const { execSync } = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const packageJson = require("../package.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const { mkdirp } = require("mkdirp");

const main = async (modName) => {
  [
    "rimraf dist/user",
    () => mkdirp.sync(`./dist/user/mods/${modName}`),
    `cpr package.json ./dist/user/mods/${modName}/package.json -o`,
    `cpr dist/src ./dist/user/mods/${modName}/src -o`,
    `cpr config ./dist/user/mods/${modName}/config -o`,
    `cpr quests ./dist/user/mods/${modName}/quests -o`,
    `cpr docs ./dist/user/mods/${modName}/docs -o`,
    `cpr README.md ./dist/user/mods/${modName}/README.md -o`,
    `cpr LICENSE ./dist/user/mods/${modName}/LICENSE -o`,
    'echo "> Successfully prepared files!"',
  ].forEach((cmd) => {
    if (typeof cmd === "string") {
      // eslint-disable-next-line no-undef
      process.stdout.write(execSync(cmd));
    } else {
      cmd();
    }
  });
};

main(packageJson.fullName);
