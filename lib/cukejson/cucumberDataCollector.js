/* eslint-disable no-use-before-define */
const _ = require("lodash");
const { EventEmitter } = require("events");
const { Status } = require("cucumber");
const {
  getStepLineToKeywordMap,
  getScenarioLineToDescriptionMap
} = require("./gherkinDocumentParser");
const {
  getStepLineToPickledStepMap,
  getScenarioDescription,
  getStepKeyword
} = require("./pickleParser");

const statuses = {
  AMBIGUOUS: "ambiguous",
  FAILED: "failed",
  PASSED: "passed",
  PENDING: "pending",
  SKIPPED: "skipped",
  UNDEFINED: "undefined"
};

class CucumberDataCollector {
  constructor(cucumberJson) {
    const eventBroadcaster = new EventEmitter();
    const gherkinDocumentMap = {}; // Uri to gherkinDocument
    const pickleMap = {}; // Uri:line to {pickle, uri}
    const testCaseMap = {}; // Uri:line to {sourceLocation, steps, result}
    let output = "";
    let timer = Date.now();
    let realUri;

    let results = {};
    let current;
    const runTests = {};
    const runScenarios = {};
    let currentScenario;
    let testError;

    eventBroadcaster
      .on("source", storeSource)
      .on("gherkin-document", storeGherkinDocument)
      .on("pickle-accepted", storePickle)
      .on("pickle", storePickle);

    // Cypress.Screenshot.defaults({
    //   onBeforeScreenshot($el) {
    //
    //   },
    //   onAfterScreenshot($el, props) {
    //     // props has information about the screenshot,
    //     // including but not limited to the following:
    //     // {
    //     //   path: '/Users/janelane/project/screenshots/my-screenshot.png',
    //     //   size: '15 kb',
    //     //   dimensions: {
    //     //     width: 1000,
    //     //     height: 660,
    //     //   },
    //     //   scaled: true,
    //     //   blackout: ['.foo'],
    //     //   duration: 2300,
    //     // }
    //     storeTestStepAttachment({
    //       index: current,
    //       testCase: currentScenario,
    //       data: props.path
    //     });
    //   }
    // });

    Cypress.Commands.add("finishTest", () => {
      Object.keys(runTests).forEach(test => {
        const scenario = runScenarios[test];
        const stepResults = runTests[test];
        Object.keys(stepResults).forEach(stepIdx => {
          const stepResult = stepResults[stepIdx];
          this.updateStepEvents(stepResult, testError, stepIdx, scenario);
        });
      });

      finishTestRun();
      cy.task(
        "writeCucumberJson",
        {
          cucumberJson,
          data: this.getOutput()
        },
        { log: false }
      );
    });

    Cypress.Commands.add("startScenario", (scenario, stepsToRun) => {
      results = {};
      current = null;
      testError = null;
      stepsToRun.forEach(step => {
        results[step.index] = { status: statuses.SKIPPED };
      });
      runScenarios[scenario.name] = scenario;
      currentScenario = scenario;
      this.updateTestCasePrepared(stepsToRun, scenario);
    });

    Cypress.Commands.add("finishScenario", scenario => {
      runTests[scenario.name] = Object.keys(results).map(result =>
        Object.assign({}, result, {
          status:
            result.status === statuses.PENDING
              ? statuses.SKIPPED
              : result.status
        })
      );
    });

    Cypress.Commands.add("startStep", step => {
      current = step.index;
      results[step.index] = { status: statuses.PENDING };
    });

    Cypress.Commands.add("finishStep", (step, result) => {
      results[step.index] = { status: result, duration: timeTaken() };
      // cy.log(`finishStep ${step.name}, result: ${result}`);
    });

    Cypress.Commands.add("missingStep", step => {
      cy.finishStep(step, statuses.UNDEFINED).then(() => {
        cy.fail(new Error("missingStep"));
      });
    });

    Cypress.Commands.add("testHasError", () => testError);

    Cypress.on("fail", err => {
      testError = err;
      if (err.message.indexOf("Step implementation missing for") > -1) {
        results[current] = {
          status: statuses.UNDEFINED,
          duration: timeTaken()
        };
      } else {
        results[current] = { status: statuses.FAILED, duration: timeTaken() };
      }

      runTests[currentScenario.name] = Object.keys(results).map(result =>
        Object.assign({}, result, {
          status:
            result.status === statuses.PENDING
              ? statuses.SKIPPED
              : result.status
        })
      );

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
        // Object.keys(pickleMap).find( key => {
        //   const values = pickleMap[key];
        //   return _.last(values.locations).line ==
        // })
        const steps = stepsToRun.map(step => ({
          sourceLocation: { uri: realUri, line: step.location.line }
        }));
        storeTestCase(formatTestCase(scenario).sourceLocation, steps);
      }
    };

    this.updateTestCaseFinished = (scenario, lastStepResult) => {
      if (cucumberJson.generate) {
        storeTestCaseResult(
          formatTestCase(scenario).sourceLocation,
          lastStepResult !== statuses.PASSED ? statuses.FAILED : statuses.PASSED
        );
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

    function convertNameToId(obj) {
      return obj.name.replace(/ /g, "-").toLowerCase();
    }

    function getTags(obj) {
      return _.map(obj.tags, tagData => ({
        name: tagData.name,
        line: tagData.location.line
      }));
    }

    function getFeatureData(feature, uri) {
      return {
        description: feature.description,
        keyword: feature.keyword,
        name: feature.name,
        line: feature.location.line,
        id: convertNameToId(feature),
        tags: getTags(feature),
        uri
      };
    }

    function getScenarioData(_ref) {
      const { featureId, pickle, scenarioLineToDescriptionMap } = _ref;

      const description = getScenarioDescription({
        pickle,
        scenarioLineToDescriptionMap
      });
      return {
        description,
        id: `${featureId};${convertNameToId(pickle)}`,
        keyword: "Scenario",
        line: pickle.locations[0].line,
        name: pickle.name,
        tags: getTags(pickle),
        type: "scenario"
      };
    }

    function formatDataTable(dataTable) {
      return {
        rows: dataTable.rows.map(row => ({ cells: _.map(row.cells, "value") }))
      };
    }

    function formatDocString(docString) {
      return {
        content: docString.content,
        line: docString.location.line
      };
    }

    function buildStepArgumentIterator(mapping) {
      return arg => {
        if (_.has(arg, "rows")) {
          return mapping.dataTable(arg);
        }

        if (_.has(arg, "content")) {
          return mapping.docString(arg);
        }
        throw new Error(`Unknown argument type:${arg}`);
      };
    }

    function formatStepArguments(stepArguments) {
      const iterator = (0, buildStepArgumentIterator)({
        dataTable: formatDataTable.bind(this),
        docString: formatDocString.bind(this)
      });
      return _.map(stepArguments, iterator);
    }

    function formatLocation(obj) {
      return `${obj.uri}:${obj.line}`;
    }

    function getStepData(_ref2) {
      const {
        isBeforeHook,
        stepLineToKeywordMap,
        stepLineToPickledStepMap,
        testStep
      } = _ref2;

      const data = {};

      if (testStep.sourceLocation) {
        const { line } = testStep.sourceLocation;

        const pickleStep = stepLineToPickledStepMap[line];
        data.arguments = pickleStep.arguments
          ? formatStepArguments(pickleStep.arguments)
          : [];
        data.keyword = getStepKeyword({
          pickleStep,
          stepLineToKeywordMap
        });
        data.line = line;
        data.name = pickleStep.text;
      } else {
        data.keyword = isBeforeHook ? "Before" : "After";
        data.hidden = true;
      }

      if (testStep.actionLocation) {
        data.match = { location: (0, formatLocation)(testStep.actionLocation) };
      }

      if (testStep.result) {
        const { exception, status } = testStep.result;

        data.result = { status };

        if (testStep.result.duration) {
          data.result.duration = testStep.result.duration * 1000000;
        }

        if (status === Status.FAILED && exception) {
          data.result.error_message = JSON.stringify(exception);
        }
      }

      if (_.size(testStep.attachments) > 0) {
        data.embeddings = testStep.attachments.map(attachment => ({
          data: attachment.data,
          mime_type: attachment.media.type
        }));
      }
      return data;
    }

    function finishTestRun() {
      const groupedTestCases = {};
      _.each(testCaseMap, testCase => {
        const { uri } = testCase.sourceLocation;

        if (!groupedTestCases[uri]) {
          groupedTestCases[uri] = [];
        }
        groupedTestCases[uri].push(testCase);
      });
      output = _.map(groupedTestCases, (group, uri) => {
        const gherkinDocument = gherkinDocumentMap[uri];
        const featureData = getFeatureData(gherkinDocument.feature, uri);
        const stepLineToKeywordMap = getStepLineToKeywordMap(gherkinDocument);
        const scenarioLineToDescriptionMap = getScenarioLineToDescriptionMap(
          gherkinDocument
        );
        featureData.elements = group.map(testCase => {
          const { pickle } = getTestCaseData(testCase.sourceLocation);
          const scenarioData = getScenarioData({
            featureId: featureData.id,
            pickle,
            scenarioLineToDescriptionMap
          });
          const stepLineToPickledStepMap = getStepLineToPickledStepMap(pickle);
          let isBeforeHook = true;
          scenarioData.steps = testCase.steps.map(testStep => {
            isBeforeHook = isBeforeHook && !testStep.sourceLocation;
            return getStepData({
              isBeforeHook,
              stepLineToKeywordMap,
              stepLineToPickledStepMap,
              testStep
            });
          });
          return scenarioData;
        });
        return featureData;
      });
    }

    function getTestCaseKey({ uri, line }) {
      return `${uri}:${line}`;
    }

    function getTestCaseData(sourceLocation) {
      return {
        gherkinDocument: gherkinDocumentMap[sourceLocation.uri],
        pickle: pickleMap[getTestCaseKey(sourceLocation)],
        testCase: testCaseMap[getTestCaseKey(sourceLocation)]
      };
    }

    this.getGherkinDocument = uri => gherkinDocumentMap[uri];

    function storeGherkinDocument({ document, uri }) {
      gherkinDocumentMap[uri] = document;
    }

    function storeSource({ uri }) {
      realUri = uri;
    }

    function storePickle({ pickle, uri }) {
      pickleMap[`${uri}:${pickle.locations[0].line}`] = pickle;
    }

    function storeTestCase(sourceLocation, steps) {
      const key = getTestCaseKey(sourceLocation);
      testCaseMap[key] = { sourceLocation, steps };
    }

    // function storeTestStepAttachment({ index, testCase, data, media }) {
    //   const key = getTestCaseKey(testCase.sourceLocation);
    //   const step = testCaseMap[key].steps[index];
    //
    //   if (!step.attachments) {
    //     step.attachments = [];
    //   }
    //   step.attachments.push({ data, media });
    // }

    function storeTestStepResult(index, testCase, result) {
      const key = getTestCaseKey(testCase.sourceLocation);
      testCaseMap[key].steps[index].result = result;
    }

    function storeTestCaseResult(sourceLocation, result) {
      const key = getTestCaseKey(sourceLocation);
      testCaseMap[key].result = result;
    }
  }
}

module.exports = { CucumberDataCollector, statuses };
