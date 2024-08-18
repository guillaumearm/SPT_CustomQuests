// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const quests = require("./quests.json");

const main = () => {
  // eslint-disable-next-line no-undef
  console.log(JSON.stringify(Object.keys(quests), undefined, 2));
};

main();
