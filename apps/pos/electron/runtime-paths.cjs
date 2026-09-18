const path = require("node:path");

function packagedAppDirectory(resourcesPath) {
  return path.join(
    resourcesPath,
    "next-server",
    "standalone",
    "apps",
    "pos",
  );
}

module.exports = { packagedAppDirectory };
