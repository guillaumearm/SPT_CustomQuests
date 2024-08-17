// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const handbook = require("./handbook.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
const locales = require("./locales_global_en.json");

const QUEST_ITEMS_TEMPLATE_ID = "5b619f1a86f77450a702a6f3";

const ALREADY_KNOWN_QUEST_ITEMS = [
  "5938188786f77474f723e87f",
  "5c12301c86f77419522ba7e4",
  "593965cf86f774087a77e1b6",
  "591092ef86f7747bb8703422",
  "590c62a386f77412b0130255",
  "5939e9b286f77462a709572c",
  "5ac620eb86f7743a8e6e0da0",
  "5938878586f7741b797c562f",
  "5d3ec50586f774183a607442",
  "5a294d7c86f7740651337cf9",
  "5a294f1686f774340c7b7e4a",
  "5efdafc1e70b5e33f86de058",
  "5939e5a786f77461f11c0098",
  "5a6860d886f77411cd3a9e47",
  "5a29357286f77409c705e025",
  "5efdaf6de6a30218ed211a48",
  "5d357d6b86f7745b606e3508",
  "5ae9a18586f7746e381e16a3",
  "5ae9a0dd86f7742e5f454a05",
  "5ae9a1b886f77404c8537c62",
  "5ae9a25386f7746dd946e6d9",
  "5ae9a3f586f7740aab00e4e6",
  "5ae9a4fc86f7746e381e1753",
  "591093bb86f7747caa7bb2ee",
  "61904c9df62c89219a56e034",
  "619268ad78f4fa33f173dbe5",
  "619268de2be33f2604340159",
  "61a00bcb177fb945751bbe6a",
  "60915994c49cf53e4772cc38",
  "60a3b6359c427533db36cf84",
  "60a3b65c27adf161da7b6e14",
  "608c22a003292f4ba43f8a1a",
  "60a3b5b05f84d429b732e934",
  "5eff135be0d3331e9d282b7b",
];

const main = () => {
  const questItems = handbook.Items.filter((item) => {
    const isQuestItem = item.ParentId === QUEST_ITEMS_TEMPLATE_ID;

    return isQuestItem && !ALREADY_KNOWN_QUEST_ITEMS.includes(item.Id);
  }).map((category) => {
    const value = locales[`${category.Id} Name`];
    return `- \`${category.Id}\` = ${value}`;
  });

  // eslint-disable-next-line no-undef
  console.log(questItems.join("\n"));
  // eslint-disable-next-line no-undef
  console.log(questItems.length);
};

main();
