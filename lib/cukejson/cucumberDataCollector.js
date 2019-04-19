// enables intelligent code completion for Cypress commands
// https://on.cypress.io/intelligent-code-completion
// <reference types="Cypress" />

const { generateCucumberJson } = require("./generateCucumberJson");

class CucumberDataCollector {
  constructor() {
    const logFn = data => {
      this.output += data;
    };

    this.output = "";

    this.onStartTest = () => {
      this.output = "";
    };

    this.onFinishTest = state => {
      state.onFinishTest();
      generateCucumberJson(state, logFn);
      return JSON.parse(this.output);
    };

    this.onStartScenario = (state, scenario, stepsToRun) => {
      state.onStartScenario(scenario, stepsToRun);
    };

    this.onFinishScenario = (state, scenario) => {
      state.onFinishScenario(scenario);
    };

    this.onStartStep = (state, step) => {
      state.onStartStep(step);
    };

    this.onFinishStep = (state, step, result) => {
      state.onFinishStep(step, result);
    };

    this.onFail = (state, err) => {
      state.onFail(err);
      throw err;
    };
  }
}
const cucumberDataCollector = new CucumberDataCollector();

module.exports = { cucumberDataCollector };
