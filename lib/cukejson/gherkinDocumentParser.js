const _ = require("lodash");

function getStepLineToKeywordMap(gherkinDocument) {
  return _.chain(gherkinDocument.feature.children)
    .map("steps")
    .flatten()
    .map(step => [step.location.line, step.keyword])
    .fromPairs()
    .value();
}

function getScenarioLineToDescriptionMap(gherkinDocument) {
  return _.chain(gherkinDocument.feature.children)
    .map(element => [element.location.line, element.description])
    .fromPairs()
    .value();
}

module.exports = { getScenarioLineToDescriptionMap, getStepLineToKeywordMap };
