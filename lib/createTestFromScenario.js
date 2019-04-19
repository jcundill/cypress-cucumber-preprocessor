/* eslint-disable prefer-template */
const statuses = require("cucumber").Status;
const { resolveAndRunStepDefinition } = require("./resolveStepDefinition");
const { TestState } = require("./cukejson/testState");

const replaceParameterTags = (rowData, text) =>
  Object.keys(rowData).reduce(
    (value, key) => value.replace(`<${key}>`, rowData[key]),
    text
  );

// eslint-disable-next-line func-names
const stepTest = function(state, stepDetails, exampleRowData) {
  cy.logStep(state, stepDetails).then(() => {
    cy.startStep(state, stepDetails)
      .then(() =>
        resolveAndRunStepDefinition.call(
          this,
          stepDetails,
          replaceParameterTags,
          exampleRowData
        )
      )
      .then(() => {
        cy.finishStep(state, stepDetails, statuses.PASSED);
      });
  });
};

const runTest = (scenario, stepsToRun, rowData) => {
  const indexedSteps = stepsToRun.map((step, index) =>
    Object.assign({}, step, { index })
  );

  // eslint-disable-next-line func-names
  it(scenario.name, function() {
    const state = window.testState;
    return cy
      .startScenario(state, scenario, indexedSteps)
      .then(() =>
        indexedSteps.forEach(step => stepTest.call(this, state, step, rowData))
      )
      .then(() => {
        cy.finishScenario(state, scenario);
      });
  });
};

const makeName = uri => {
  const arr = uri.split("/");
  return arr[arr.length - 1].split(".")[0];
};

const writeCucumberJsonFile = json => {
  const outputFolder =
    window.cucumberJson.outputFolder || "cypress/cucumber-json";
  const outputPrefix = window.cucumberJson.filePrefix || "";
  const outputSuffix = window.cucumberJson.fileSuffix || "";
  const fileName = json[0] ? makeName(json[0].uri) : "empty";
  const outFile = `${outputFolder}/${outputPrefix}${fileName}${outputSuffix}.json`;
  cy.writeFile(outFile, json, { log: false });
};

const createTestFromScenarios = (
  name,
  scenariosToRun,
  backgroundSection,
  filePath,
  spec
) => {
  // eslint-disable-next-line func-names
  describe(name, function() {
    let state;

    before(() => {
      state = new TestState(filePath, spec);
      window.testState = state;
      cy.startTest();
    });

    // ctx is cleared between each 'it'
    beforeEach(() => {
      state = window.testState;
    });

    scenariosToRun.forEach(section => {
      if (section.examples) {
        section.examples.forEach(example => {
          const exampleValues = [];
          const exampleLocations = [];

          example.tableBody.forEach((row, rowIndex) => {
            exampleLocations[rowIndex] = row.location;
            example.tableHeader.cells.forEach((header, headerIndex) => {
              exampleValues[rowIndex] = Object.assign(
                {},
                exampleValues[rowIndex],
                {
                  [header.value]: row.cells[headerIndex].value
                }
              );
            });
          });

          exampleValues.forEach((rowData, index) => {
            // eslint-disable-next-line prefer-arrow-callback
            const scenarioName = replaceParameterTags(rowData, section.name);
            const uniqueScenarioName = `${scenarioName} (example #${index +
              1})`;
            const exampleSteps = section.steps.map(step => {
              const newStep = Object.assign({}, step);
              newStep.text = replaceParameterTags(rowData, newStep.text);
              return newStep;
            });

            const stepsToRun = backgroundSection
              ? backgroundSection.steps.concat(exampleSteps)
              : exampleSteps;

            const scenarioExample = Object.assign({}, section, {
              name: uniqueScenarioName,
              example: exampleLocations[index]
            });

            runTest.call(this, scenarioExample, stepsToRun, rowData);
          });
        });
      } else {
        const stepsToRun = backgroundSection
          ? backgroundSection.steps.concat(section.steps)
          : section.steps;

        runTest.call(this, section, stepsToRun);
      }
    });

    after(() => {
      cy.finishTest(window.testState).then(json => {
        if (window.cucumberJson.generate) {
          writeCucumberJsonFile(json);
        }
      });
    });
  });
};

module.exports = {
  createTestFromScenarios
};
