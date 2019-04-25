/* eslint-disable no-eval */
const log = require("debug")("cypress:cucumber");
const cosmiconfig = require("cosmiconfig");
const { getStepDefinitionsPaths } = require("./getStepDefinitionsPaths");

// This is the template for the file that we will send back to cypress instead of the text of a
// feature file
const createCucumber = (filePath, cucumberJson, spec, toRequire) =>
  `
  const {resolveAndRunStepDefinition, defineParameterType, given, when, then, and, but} = require('cypress-cucumber-preprocessor/lib/resolveStepDefinition');
  const Given = window.Given = window.given = given;
  const When = window.When = window.when = when;
  const Then = window.Then = window.then = then;
  const And = window.And = window.and = and;
  const But = window.But = window.but = but;
  window.defineParameterType = defineParameterType;
  const { createTestsFromFeature } = require('cypress-cucumber-preprocessor/lib/createTestsFromFeature');
  ${eval(toRequire).join("\n")}
  const { CucumberDataCollector } = require("cypress-cucumber-preprocessor/lib/cukejson/cucumberDataCollector");
  const {Parser, Compiler, generateEvents} = require('gherkin');
  const spec = \`${spec}\`;
  const filePath = '${filePath}';

  const cucumberDataCollector = new CucumberDataCollector(filePath, ${JSON.stringify(
    cucumberJson
  )});
  
  Cypress.Commands.add("finishTest", cucumberDataCollector.onFinishTest);
  Cypress.Commands.add("startScenario", cucumberDataCollector.onStartScenario);
  Cypress.Commands.add("finishScenario", cucumberDataCollector.onFinishScenario);
  Cypress.Commands.add("startStep", cucumberDataCollector.onStartStep);
  Cypress.Commands.add("finishStep", cucumberDataCollector.onFinishStep);
  Cypress.on("fail", cucumberDataCollector.onFail);
  Cypress.Commands.add("missingStep", cucumberDataCollector.onMissingStep);

  generateEvents(spec, filePath).forEach(event => {
    cucumberDataCollector.recordGherkinEvent(event.type, event);
  });
  
  const gherkinAst = new Parser().parse(spec);

  createTestsFromFeature(gherkinAst);
  `;

module.exports = (spec, filePath = this.resourcePath) => {
  const explorer = cosmiconfig("cypress-cucumber-preprocessor", { sync: true });
  const loaded = explorer.load();
  const cucumberJson =
    loaded && loaded.config && loaded.config.cucumberJson
      ? loaded.config.cucumberJson
      : { generate: true };

  log("compiling", spec);
  log("cucumber.json", JSON.stringify(cucumberJson));
  const stepDefinitionsToRequire = getStepDefinitionsPaths(filePath).map(
    sdPath => `require('${sdPath}')`
  );
  return createCucumber(filePath, cucumberJson, spec, stepDefinitionsToRequire);
};
