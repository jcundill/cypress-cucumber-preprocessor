const { Parser } = require("gherkin");
const statuses = require("cucumber").Status;

class CucumberDataCollector {
  constructor(uri, spec) {
    this.feature = new Parser().parse(spec.toString()).feature;
    this.scenarioSteps = {};
    this.runScenarios = {};
    this.runTests = {};
    this.stepResults = {};
    this.testError = null;
    this.uri = uri;
    this.spec = spec;
    this.screenshots = {};
    this.logMsgs = {};

    this.currentScenario = null;
    this.currentStep = 0;

    this.timer = Date.now();

    this.logStep = step => {
      Cypress.log({
        name: "step",
        displayName: step.keyword,
        message: `**${step.text}**`,
        consoleProps: () => ({ feature: this.uri, step })
      });
    };

    this.onStartTest = () => {
      Cypress.Commands.overwrite(
        "screenshot",
        (origFunc, subject, fileName, options) => {
          const cukeOptions = Object.assign({}, options, {
            onAfterScreenshot: ($el, props) => {
              this.attachScreenshotToCurrentStep(props.path);
            }
          });
          return origFunc(subject, fileName, cukeOptions);
        }
      );
      Cypress.Commands.overwrite("log", (origFunc, msg, args) => {
        this.attachLogMsgToCurrentStep(msg, args);
        return origFunc(msg, args);
      });
    };

    this.onFinishTest = () => {
      if (this.testError) {
        this.attachErrorToFailingStep();
      }
    };

    this.onStartScenario = (scenario, stepsToRun) => {
      this.currentScenario = scenario;
      this.currentStep = 0;
      this.stepResults = {};
      this.scenarioSteps[scenario.name] = stepsToRun;
      this.testError = null;
      this.screenshots = {};
      this.logMsgs = {};

      stepsToRun.forEach(step => {
        this.stepResults[step.index] = { status: statuses.PENDING };
      });
      this.runScenarios[scenario.name] = scenario;
    };

    this.onFinishScenario = scenario => {
      this.markStillPendingStepsAsSkipped(scenario);
      this.recordScenarioResult(scenario);
    };

    this.onStartStep = step => {
      this.currentStep = step.index;
      this.setStepToPending(step);
      this.logStep(step);
    };

    this.onFinishStep = (step, result) => {
      this.recordStepResult(step, result);
      return this.processAttachments(step.index);
    };

    this.onFinishBefore = () => this.processAttachments(0);

    this.onFinishAfter = () => this.processAttachments(this.currentStep);

    this.onFail = err => {
      this.testError = err;
      if (
        err.message &&
        err.message.indexOf("Step implementation missing for") > -1
      ) {
        this.stepResults[this.currentStep] = {
          status: statuses.UNDEFINED,
          duration: this.timeTaken()
        };
      } else {
        this.stepResults[this.currentStep] = {
          status: statuses.FAILED,
          duration: this.timeTaken(),
          exception: this.testError
        };
        this.processAttachments(this.currentStep);
      }
      this.onFinishScenario(this.currentScenario);
    };

    this.timeTaken = () => {
      const now = Date.now();
      const duration = now - this.timer;
      this.timer = now;
      return duration;
    };

    this.formatTestCase = scenario => {
      const line = scenario.example
        ? scenario.example.line
        : scenario.location.line;
      return {
        sourceLocation: { uri, line }
      };
    };

    this.attachScreenshotToCurrentStep = fileName => {
      const stepScreenshots = this.screenshots[this.currentStep] || [];
      stepScreenshots.push(fileName);
      this.screenshots[this.currentStep] = stepScreenshots;
    };

    this.attachLogMsgToCurrentStep = (msg, args) => {
      const stepMsgs = this.logMsgs[this.currentStep] || [];
      stepMsgs.push(`${msg} ${args ? JSON.stringify(args) : ""}`);
      this.logMsgs[this.currentStep] = stepMsgs;
    };

    this.attachErrorToFailingStep = () => {
      Object.keys(this.runTests).forEach(test => {
        const stepResults = this.runTests[test];
        Object.keys(stepResults).forEach(stepIdx => {
          const stepResult = stepResults[stepIdx];
          if (stepResult.result === statuses.FAILED) {
            stepResult.exception = this.testError;
          }
        });
      });
    };

    this.markStillPendingStepsAsSkipped = scenario => {
      this.runTests[scenario.name] = Object.keys(this.stepResults).map(key => {
        const result = this.stepResults[key];
        return Object.assign({}, result, {
          status:
            result.status === statuses.PENDING
              ? statuses.SKIPPED
              : result.status
        });
      });
    };
    this.recordScenarioResult = scenario => {
      this.runTests[scenario.name].result = this.anyStepsHaveFailed(scenario)
        ? statuses.FAILED
        : statuses.PASSED;
    };

    this.setStepToPending = step => {
      this.stepResults[step.index] = { status: statuses.PENDING };
    };

    this.recordStepResult = (step, result) => {
      this.stepResults[step.index] = {
        status: result,
        duration: this.timeTaken()
      };
    };

    this.anyStepsHaveFailed = () =>
      Object.values(this.stepResults).find(e => e.status !== statuses.PASSED);
  }

  processAttachments(stepIdx) {
    const attachments = this.stepResults[stepIdx].attachments || [];

    const logMsgs = this.logMsgs[stepIdx];
    (logMsgs || []).forEach(msg =>
      attachments.push({
        index: stepIdx,
        testCase: this.formatTestCase(this.currentScenario),
        data: btoa(msg),
        media: {
          type: typeof msg === "object" ? "application/json" : "text/plain"
        }
      })
    );

    const screenshots = this.screenshots[stepIdx];
    (screenshots || []).forEach(screenshot => {
      cy.readFile(screenshot, "base64", { log: false }).then(base64Image => {
        attachments.push({
          index: stepIdx,
          testCase: this.formatTestCase(this.currentScenario),
          data: base64Image,
          media: { type: "image/png" }
        });
      });
    });

    this.stepResults[stepIdx].attachments = attachments;
  }
}

module.exports = { CucumberDataCollector };
