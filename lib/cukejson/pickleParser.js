const _ = require("lodash");

function getScenarioDescription({ pickle, scenarioLineToDescriptionMap }) {
  return _.chain(pickle.locations)
    .map(({ line }) => scenarioLineToDescriptionMap[line])
    .compact()
    .first()
    .value();
}

function getStepKeyword({ pickleStep, stepLineToKeywordMap }) {
  return _.chain(pickleStep.locations)
    .map(({ line }) => stepLineToKeywordMap[line])
    .compact()
    .first()
    .value();
}

function getStepLineToPickledStepMap(pickle) {
  return _.chain(pickle.steps)
    .map(step => [_.last(step.locations).line, step])
    .fromPairs()
    .value();
}

module.exports = {
  getScenarioDescription,
  getStepKeyword,
  getStepLineToPickledStepMap
};
