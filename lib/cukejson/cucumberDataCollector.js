/* eslint-disable no-use-before-define */
const { EventEmitter } = require("events");
const { Status, JsonFormatter, formatterHelpers } = require("cucumber");

const statuses = Status;

class CucumberDataCollector {
  constructor(realUri, cucumberJson) {
    const eventBroadcaster = new EventEmitter();

    const logFn = data => {
      this.output += data;
    };
    let timer = Date.now();
    this.output = "";
    this.results = {};
    this.runTests = {};
    this.runScenarios = {};
    this.currentScenario = null;
    this.currentStep = 0;
    this.testError = null;

    eventBroadcaster.on("pickle", storePickle);

    // eslint-disable-next-line no-new
    new JsonFormatter({
      eventBroadcaster,
      eventDataCollector: new formatterHelpers.EventDataCollector(
        eventBroadcaster
      ),
      log: logFn
    });

    this.onFinishTest = () => {
      if (cucumberJson.generate) {
        Object.keys(this.runTests).forEach(test => {
          const scenario = this.runScenarios[test];
          const stepResults = this.runTests[test];
          Object.keys(stepResults).forEach(stepIdx => {
            const stepResult = stepResults[stepIdx];
            const result = { result: stepResult.status, error: this.testError };
            const res = {
              duration: stepResult.duration,
              status: result.result
            };
            if (result.result === statuses.FAILED) {
              res.exception = this.testError;
            }
            storeTestStepResult(stepIdx, formatTestCase(scenario), res);
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
      }
    };

    this.onStartScenario = (scenario, stepsToRun) => {
      if (cucumberJson.generate) {
        this.results = {};
        this.currentStep = 0;
        this.currentScenario = scenario;
        this.testError = null;
        stepsToRun.forEach(step => {
          this.results[step.index] = { status: statuses.SKIPPED };
        });
        this.runScenarios[scenario.name] = scenario;
        if (cucumberJson.generate) {
          const steps = stepsToRun.map(step => ({
            sourceLocation: { uri: realUri, line: step.location.line }
          }));
          storeTestCase(formatTestCase(scenario).sourceLocation, steps);
        }
      }
    };

    this.onFinishScenario = scenario => {
      if (cucumberJson.generate) {
        this.runTests[scenario.name] = Object.keys(this.results).map(key => {
          const result = this.results[key];
          return Object.assign({}, result, {
            status:
              result.status === statuses.PENDING
                ? statuses.SKIPPED
                : result.status
          });
        });
        const result = Object.values(this.results).find(
          e => e.status !== statuses.PASSED
        )
          ? statuses.FAILED
          : statuses.PASSED;
        if (cucumberJson.generate) {
          storeTestCaseResult(formatTestCase(scenario).sourceLocation, result);
        }
      }
    };

    this.onStartStep = step => {
      if (cucumberJson.generate) {
        this.currentStep = step.index;
        this.results[step.index] = { status: statuses.PENDING };
      }
    };

    this.onFinishStep = (step, result) => {
      if (cucumberJson.generate) {
        this.results[step.index] = { status: result, duration: timeTaken() };
      }
    };

    this.onMissingStep = step => {
      if (cucumberJson.generate) {
        this.onFinishStep(step, statuses.UNDEFINED);
        this.onFail(new Error(`Step implementation missing for ${step.text}`));
      }
    };

    this.onFail = err => {
      if (cucumberJson.generate) {
        this.testError = err;
        if (err.message.indexOf("Step implementation missing for") > -1) {
          this.results[this.currentStep] = {
            status: statuses.UNDEFINED,
            duration: timeTaken()
          };
        } else {
          const attachment = {
            index: this.currentStep,
            testCase: formatTestCase(this.currentScenario),
            data: btoa(err.message.toString()),
            media: { type: "text/plain" }
          };
          eventBroadcaster.emit("test-step-attachment", attachment);
          this.results[this.currentStep] = {
            status: statuses.FAILED,
            duration: timeTaken()
          };
        }

        this.runTests[this.currentScenario.name] = Object.keys(
          this.results
        ).map(key => {
          const result = this.results[key];
          return Object.assign({}, result, {
            status:
              result.status === statuses.PENDING
                ? statuses.SKIPPED
                : result.status
          });
        });
      }

      throw err;
    };

    this.recordGherkinEvent = (type, args) => eventBroadcaster.emit(type, args);

    this.getOutput = () => this.output;

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
