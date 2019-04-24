const {
  cucumber,
  writeCucumberJson
} = require("cypress-cucumber-preprocessor"); // eslint-disable-line

module.exports = on => {
  on("task", { writeCucumberJson });

  on("file:preprocessor", cucumber());
};
