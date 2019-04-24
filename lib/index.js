/* eslint-disable no-eval */
const fs = require("fs");
const path = require("path");
const through = require("through");
const browserify = require("@cypress/browserify-preprocessor");
const log = require("debug")("cypress:cucumber");
const chokidar = require("chokidar");
const compile = require("./loader.js");
const stepDefinitionPath = require("./stepDefinitionPath.js");

const transform = file => {
  let data = "";

  function write(buf) {
    data += buf;
  }

  function end() {
    if (file.match(".feature$")) {
      log("compiling feature ", file);
      this.queue(compile(data, file));
    } else {
      this.queue(data);
    }
    this.queue(null);
  }

  return through(write, end);
};

const touch = filename => {
  fs.utimesSync(filename, new Date(), new Date());
};

let watcher;
const preprocessor = (options = browserify.defaultOptions) => file => {
  if (options.browserifyOptions.transform.indexOf(transform) === -1) {
    options.browserifyOptions.transform.unshift(transform);
  }

  if (file.shouldWatch) {
    if (watcher) {
      watcher.close();
    }
    watcher = chokidar
      .watch([`${stepDefinitionPath()}*.js`, `${stepDefinitionPath()}*.ts`], {
        ignoreInitial: true
      })
      .on("all", () => {
        touch(file.filePath);
      });
  }
  return browserify(options)(file);
};

const writeCucumberJson = ({ cucumberJson, data }) => {
  const { uri } = data[0];
  const filename = path.basename(uri, path.extname(uri));
  const output = JSON.stringify(data, null, 2);
  const outputFolder = cucumberJson.outputFolder || ".";
  const outputPrefix = cucumberJson.filePrefix || "cucumber-";
  const outFile = `${outputFolder}/${outputPrefix}${filename}.json`;
  log(`writing cucumber.json for feature '${filename}' to '${outFile}'`);
  log(output);
  fs.writeFileSync(outFile, output);
  return null;
};

module.exports = {
  cucumber: preprocessor,
  transform,
  writeCucumberJson
};
