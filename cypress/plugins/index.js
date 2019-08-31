const cucumber = require("cypress-cucumber-preprocessor").default; // eslint-disable-line
const { generateCucumberJson } = require("cypress-cucumber-preprocessor").generateCucumberJson; // eslint-disable-line

module.exports = on => {
  on("file:preprocessor", cucumber());
  on("task", {
    generateCucumberJson
  });
};
