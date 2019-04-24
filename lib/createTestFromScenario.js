/* eslint-disable prefer-template */
const { resolveAndRunStepDefinition } = require("./resolveStepDefinition");
const { statuses } = require("./cukejson/cucumberDataCollector");

const replaceParameterTags = (rowData, text) =>
  Object.keys(rowData).reduce(
    (value, key) => value.replace(`<${key}>`, rowData[key]),
    text
  );

const stepTest = function(stepDetails, exampleRowData) {
  cy.log(`${stepDetails.keyword} ${stepDetails.text}`);
  cy.startStep(stepDetails)
    .then(() =>
      resolveAndRunStepDefinition.call(
        this,
        stepDetails,
        replaceParameterTags,
        exampleRowData
      )
    )
    .then(retVal => {
      if (
        retVal &&
        retVal.message &&
        retVal.message.startsWith("Step implementation missing for:")
      ) {
        cy.missingStep(stepDetails);
      } else if (retVal && retVal.message) {
        cy.fail(retVal);
      } else {
        cy.finishStep(stepDetails, statuses.PASSED);
      }
    });
};

const runTest = (scenario, stepsToRun, isLast, rowData) => {
  const indexedSteps = stepsToRun.map((step, index) =>
    Object.assign({}, step, { index })
  );

  it(scenario.name, () =>
    cy
      .startScenario(scenario, indexedSteps)
      .then(() =>
        indexedSteps.forEach(step => stepTest.call(this, step, rowData))
      )
      .then(() => {
        cy.finishScenario(scenario);
      })
      .then(() => {
        if (isLast) {
          cy.finishTest();
        }
      })
  );
};

const createTestFromScenarios = (scenariosToRun, backgroundSection) => {
  scenariosToRun.forEach(section => {
    const isLast = scenariosToRun[scenariosToRun.length - 1] === section;
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
          const uniqueScenarioName = `${scenarioName} (example #${index + 1})`;
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

          runTest(
            scenarioExample,
            stepsToRun,
            isLast && index === exampleValues.length - 1,
            rowData
          );
        });
      });
    } else {
      const stepsToRun = backgroundSection
        ? backgroundSection.steps.concat(section.steps)
        : section.steps;

      runTest(section, stepsToRun, isLast);
    }
  });
};

module.exports = {
  createTestFromScenarios
};
