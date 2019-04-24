const { createTestFromScenarios } = require("./createTestFromScenario");
const { shouldProceedCurrentStep, getEnvTags } = require("./tagsHelper");

const createTestsFromFeature = parsedFeature => {
  const featureTags = parsedFeature.feature.tags;
  const hasEnvTags = !!getEnvTags();
  const sectionsWithTags = parsedFeature.feature.children.filter(
    section => section.tags && section.tags.length
  );

  const sectionsWithTagsExist = sectionsWithTags.length > 0;

  let everythingShouldRun = false;
  let featureShouldRun = false;
  let taggedScenarioShouldRun = false;
  let anyFocused = false;
  if (hasEnvTags) {
    featureShouldRun = shouldProceedCurrentStep(featureTags);
    taggedScenarioShouldRun = parsedFeature.feature.children.some(
      section =>
        section.tags &&
        section.tags.length &&
        shouldProceedCurrentStep(section.tags)
    );
  } else if (!sectionsWithTagsExist) {
    everythingShouldRun = true;
  } else {
    anyFocused = sectionsWithTags.some(section =>
      section.tags.find(t => t.name === "@focus")
    );
    if (anyFocused) {
      taggedScenarioShouldRun = true;
    } else {
      everythingShouldRun = true;
    }
  }

  // eslint-disable-next-line prefer-arrow-callback
  describe(parsedFeature.feature.name, function() {
    if (everythingShouldRun || featureShouldRun || taggedScenarioShouldRun) {
      const backgroundSection = parsedFeature.feature.children.find(
        section => section.type === "Background"
      );
      const otherSections = parsedFeature.feature.children.filter(
        section => section.type !== "Background"
      );
      const scenariosToRun = otherSections.filter(section => {
        let shouldRun;
        if (anyFocused) {
          shouldRun = section.tags.find(t => t.name === "@focus");
        } else {
          shouldRun =
            everythingShouldRun ||
            shouldProceedCurrentStep(section.tags.concat(featureTags)); // Concat handles inheritance of tags from feature
        }
        return shouldRun;
      });
      createTestFromScenarios(scenariosToRun, backgroundSection);
    }
  });
};

module.exports = {
  createTestsFromFeature
};
