/* eslint-disable no-use-before-define */
const { EventEmitter } = require("events");
const { Status, JsonFormatter, formatterHelpers } = require("cucumber");

const statuses = Status;

class CucumberDataCollector {
  constructor(cucumberJson) {
    const eventBroadcaster = new EventEmitter();

    let output = "";
    const logFn = data => {
      output += data;
    };
    let timer = Date.now();
    let realUri;

    let results = {};
    let currentStep;
    const runTests = {};
    const runScenarios = {};
    let currentScenario;
    let testError;

    eventBroadcaster.on("pickle", storePickle).on("source", storeSource);

    // eslint-disable-next-line no-new
    new JsonFormatter({
      eventBroadcaster,
      eventDataCollector: new formatterHelpers.EventDataCollector(
        eventBroadcaster
      ),
      log: logFn
    });

    Cypress.Commands.add("finishTest", () => {
      Object.keys(runTests).forEach(test => {
        const scenario = runScenarios[test];
        const stepResults = runTests[test];
        Object.keys(stepResults).forEach(stepIdx => {
          const stepResult = stepResults[stepIdx];
          this.updateStepEvents(stepResult, testError, stepIdx, scenario);
        });
      });

      eventBroadcaster.emit("test-run-finished", {});

      cy.task(
        "writeCucumberJson",
        {
          cucumberJson,
          data: JSON.parse(this.getOutput())
        },
        { log: false }
      );
    });

    Cypress.Commands.add("startScenario", (scenario, stepsToRun) => {
      results = {};
      currentStep = 0;
      currentScenario = scenario;
      testError = null;
      stepsToRun.forEach(step => {
        results[step.index] = { status: statuses.SKIPPED };
      });
      runScenarios[scenario.name] = scenario;
      this.updateTestCasePrepared(stepsToRun, scenario);
    });

    Cypress.Commands.add("finishScenario", scenario => {
      runTests[scenario.name] = Object.keys(results).map(key => {
        const result = results[key];
        return Object.assign({}, result, {
          status:
            result.status === statuses.PENDING
              ? statuses.SKIPPED
              : result.status
        });
      });
      const result = Object.values(results).find(
        e => e.status !== statuses.PASSED
      )
        ? statuses.FAILED
        : statuses.PASSED;
      this.updateTestCaseFinished(scenario, result);
    });

    Cypress.Commands.add("startStep", step => {
      currentStep = step.index;
      results[step.index] = { status: statuses.PENDING };
    });

    Cypress.Commands.add("finishStep", (step, result) => {
      results[step.index] = { status: result, duration: timeTaken() };
    });

    Cypress.Commands.add("missingStep", step => {
      cy.finishStep(step, statuses.UNDEFINED).then(() => {
        cy.fail(new Error(`Step implementation missing for ${step.text}`));
      });
    });

    Cypress.on("fail", err => {
      testError = err;
      if (err.message.indexOf("Step implementation missing for") > -1) {
        results[currentStep] = {
          status: statuses.UNDEFINED,
          duration: timeTaken()
        };
      } else {
        results[currentStep] = {
          status: statuses.FAILED,
          duration: timeTaken()
        };
      }

      runTests[currentScenario.name] = Object.keys(results).map(key => {
        const result = results[key];
        return Object.assign({}, result, {
          status:
            result.status === statuses.PENDING
              ? statuses.SKIPPED
              : result.status
        });
      });

      throw err;
    });

    this.recordGherkinEvent = (type, args) => eventBroadcaster.emit(type, args);

    this.getOutput = () => output;

    const timeTaken = () => {
      const now = Date.now();
      const duration = now - timer;
      timer = now;
      return duration;
    };

    const formatTestCase = scenario => {
      const line = scenario.example
        ? scenario.example.line
        : scenario.location.line;
      return {
        sourceLocation: { uri: realUri, line }
      };
    };

    this.updateTestCasePrepared = (stepsToRun, scenario) => {
      if (cucumberJson.generate) {
        const steps = stepsToRun.map(step => ({
          sourceLocation: { uri: realUri, line: step.location.line }
        }));
        storeTestCase(formatTestCase(scenario).sourceLocation, steps);
      }
    };

    this.updateTestCaseFinished = (scenario, result) => {
      if (cucumberJson.generate) {
        storeTestCaseResult(formatTestCase(scenario).sourceLocation, result);
      }
    };

    this.updateStepEvents = (stepResult, lastStepError, idx, scenario) => {
      if (cucumberJson.generate) {
        const result = { result: stepResult.status, error: lastStepError };
        const res = {
          duration: stepResult.duration,
          status: result.result
        };
        if (result.result === statuses.FAILED) {
          res.exception = lastStepError;
        }
        storeTestStepResult(idx, formatTestCase(scenario), res);
      }
    };

    function storeSource({ uri }) {
      realUri = uri;
    }

    function storePickle({ pickle, uri }) {
      eventBroadcaster.emit("pickle-accepted", { pickle, uri });
    }

    function storeTestCase(sourceLocation, steps) {
      eventBroadcaster.emit("test-case-prepared", { sourceLocation, steps });
    }

    function storeTestStepResult(index, testCase, result) {
      eventBroadcaster.emit("test-step-finished", { index, testCase, result });
    }

    function storeTestCaseResult(sourceLocation, result) {
      eventBroadcaster.emit("test-case-finished", { sourceLocation, result });
    }
  }
}

module.exports = { CucumberDataCollector, statuses };
