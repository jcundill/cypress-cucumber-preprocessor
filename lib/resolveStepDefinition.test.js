/* eslint-disable global-require */
/* global jest */
const fs = require("fs");
const { createTestsFromFeature } = require("./createTestsFromFeature");
const {
  defineParameterType,
  when,
  then,
  given,
  and,
  but
} = require("./resolveStepDefinition");

const mockedPromise = jest.fn().mockImplementation(() => Promise.resolve(true));

window.defineParameterType = defineParameterType;
window.when = when;
window.then = then;
window.given = given;
window.and = and;
window.but = but;
window.cy = {
  log: jest.fn(),
  logStep: mockedPromise,
  startScenario: mockedPromise,
  finishScenario: mockedPromise,
  startStep: mockedPromise,
  finishStep: mockedPromise,
  finishTest: mockedPromise
};

window.before = jest.fn();
window.after = jest.fn();

window.Cypress = {
  env: jest.fn()
};

const makeTestForFeature = featureFile =>
  createTestsFromFeature.call(
    this,
    featureFile,
    fs.readFileSync(featureFile).toString()
  );

describe("Scenario Outline", () => {
  require("../cypress/support/step_definitions/scenario_outline_integer");
  require("../cypress/support/step_definitions/scenario_outline_string");
  require("../cypress/support/step_definitions/scenario_outline_data_table");
  makeTestForFeature("./cypress/integration/ScenarioOutline.feature");
});

describe("DocString", () => {
  require("../cypress/support/step_definitions/docString");
  makeTestForFeature("./cypress/integration/DocString.feature");
});

describe("Data table", () => {
  require("../cypress/support/step_definitions/dataTable");
  makeTestForFeature("./cypress/integration/DataTable.feature");
});

describe("Basic example", () => {
  require("../cypress/support/step_definitions/basic");
  makeTestForFeature("./cypress/integration/Plugin.feature");
});

describe("Background section", () => {
  require("../cypress/support/step_definitions/backgroundSection");
  makeTestForFeature("./cypress/integration/BackgroundSection.feature");
});

describe("Regexp", () => {
  require("../cypress/support/step_definitions/regexp");
  makeTestForFeature("./cypress/integration/RegularExpressions.feature");
});

describe("Custom Parameter Types", () => {
  require("../cypress/support/step_definitions/customParameterTypes");
  makeTestForFeature("./cypress/integration/CustomParameterTypes.feature");
});

describe("Tags implementation", () => {
  require("../cypress/support/step_definitions/tags_implementation");
  makeTestForFeature("./cypress/integration/TagsImplementation.feature");
});

describe("Tags with env TAGS set", () => {
  window.Cypress = {
    env: () => "@test-tag and not @ignore-tag"
  };
  require("../cypress/support/step_definitions/tags_implementation_with_env_set");
  makeTestForFeature(
    "./cypress/integration/TagsImplementationWithEnvSet.feature"
  );

  makeTestForFeature(
    "./cypress/integration/TagsImplementationWithEnvSet.feature"
  );
});

describe("Smart tagging", () => {
  window.Cypress = {
    env: () => ""
  };
  require("../cypress/support/step_definitions/smart_tagging");
  makeTestForFeature("./cypress/integration/SmartTagging.feature");
});

describe("And and But", () => {
  require("../cypress/support/step_definitions/and_and_but_steps");
  makeTestForFeature("./cypress/integration/AndAndButSteps.feature");
});
