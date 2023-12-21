const fs = require("fs-extra");
const concat = require("concat");

const build = async () => {
  const files = [
    "./dist/lobby/runtime.js",
    "./dist/lobby/polyfills.js",
    //"./dist/lobby/styles.js",
    //"./dist/lobby/vendor.js",
    "./dist/lobby/main.js",
  ];

  await fs.ensureDir("dist/lobby");
  await concat(files, "./dist/lobby/shig-lobby.js");
  console.log("Files concatenated successfully!!!");
};
build();
