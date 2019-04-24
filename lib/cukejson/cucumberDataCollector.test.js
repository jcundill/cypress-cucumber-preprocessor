const fs = require("fs");
const { generateEvents } = require("gherkin");
const { CucumberDataCollector, statuses } = require("./cucumberDataCollector");

window.cy = {
  task: jest.fn()
};

const assertCucumberJson = (json, expectedResults) => {
  expect(json).to.have.length(1);
  expect(json[0].keyword).to.eql("Feature");
  expect(json[0].name).to.eql("Being a plugin");
  expect(json[0].elements).to.have.length(1);
  expect(json[0].elements[0].keyword).to.eql("Scenario");
  expect(json[0].elements[0].name).to.eql("Basic example");
  expect(json[0].elements[0].steps).to.have.length(3);
  expect(json[0].elements[0].steps[0].keyword).to.equal("Given ");
  expect(json[0].elements[0].steps[0].name).to.equal(
    "a feature and a matching step definition file"
  );
  // eslint-disable-next-line no-unused-expressions
  expect(json[0].elements[0].steps[0].result).to.be.not.null;
  expect(json[0].elements[0].steps[0].result.status).to.eql(expectedResults[0]);
  expect(json[0].elements[0].steps[1].keyword).to.equal("When ");
  expect(json[0].elements[0].steps[1].name).to.equal("I run cypress tests");
  // eslint-disable-next-line no-unused-expressions
  expect(json[0].elements[0].steps[1].result).to.be.not.null;
  expect(json[0].elements[0].steps[1].result.status).to.eql(expectedResults[1]);
  expect(json[0].elements[0].steps[2].keyword).to.equal("Then ");
  expect(json[0].elements[0].steps[2].name).to.equal("they run properly");
  // eslint-disable-next-line no-unused-expressions
  expect(json[0].elements[0].steps[2].result).to.be.not.null;
  expect(json[0].elements[0].steps[2].result.status).to.eql(expectedResults[2]);
};
describe("Cucumber Data Collector", () => {
  const scenario = {
    type: "Scenario",
    tags: [],
    location: { line: 7, column: 3 },
    keyword: "Scenario",
    name: "Basic example",
    steps: [
      {
        type: "Step",
        location: { line: 8, column: 5 },
        keyword: "Given ",
        text: "a feature and a matching step definition file"
      },
      {
        type: "Step",
        location: { line: 9, column: 5 },
        keyword: "When ",
        text: "I run cypress tests"
      },
      {
        type: "Step",
        location: { line: 10, column: 5 },
        keyword: "Then ",
        text: "they run properly"
      }
    ]
  };

  const stepsToRun = [
    {
      type: "Step",
      location: { line: 8, column: 5 },
      keyword: "Given ",
      text: "a feature and a matching step definition file",
      index: 0
    },
    {
      type: "Step",
      location: { line: 9, column: 5 },
      keyword: "When ",
      text: "I run cypress tests",
      index: 1
    },
    {
      type: "Step",
      location: { line: 10, column: 5 },
      keyword: "Then ",
      text: "they run properly",
      index: 2
    }
  ];

  beforeEach(() => {
    const filePath = "./cypress/integration/Plugin.feature";
    const spec = fs.readFileSync(filePath);
    this.cdc = new CucumberDataCollector(filePath, { generate: true });
    generateEvents(spec.toString(), filePath).forEach(event => {
      this.cdc.recordGherkinEvent(event.type, event);
    });
  });

  it("runs", () => {
    this.cdc.onFinishTest();
    const output = this.cdc.getOutput();
    expect(output).to.eql("[]");
  });

  it("records pending scenarios", () => {
    this.cdc.onStartScenario(scenario, stepsToRun);
    this.cdc.onFinishScenario(scenario);
    this.cdc.onFinishTest();
    const json = JSON.parse(this.cdc.getOutput());
    assertCucumberJson(json, [
      statuses.SKIPPED,
      statuses.SKIPPED,
      statuses.SKIPPED
    ]);
  });
  it("records passed scenarios", () => {
    this.cdc.onStartScenario(scenario, stepsToRun);
    this.cdc.onStartStep(stepsToRun[0]);
    this.cdc.onFinishStep(stepsToRun[0], statuses.PASSED);
    this.cdc.onStartStep(stepsToRun[1]);
    this.cdc.onFinishStep(stepsToRun[1], statuses.PASSED);
    this.cdc.onStartStep(stepsToRun[2]);
    this.cdc.onFinishStep(stepsToRun[2], statuses.PASSED);
    this.cdc.onFinishScenario(scenario);
    this.cdc.onFinishTest();
    const json = JSON.parse(this.cdc.getOutput());
    assertCucumberJson(json, [
      statuses.PASSED,
      statuses.PASSED,
      statuses.PASSED
    ]);
  });

  it("records failed scenarios", () => {
    this.cdc.onStartScenario(scenario, stepsToRun);
    this.cdc.onStartStep(stepsToRun[0]);
    this.cdc.onFinishStep(stepsToRun[0], statuses.PASSED);
    this.cdc.onStartStep(stepsToRun[1]);
    this.cdc.onFinishStep(stepsToRun[1], statuses.FAILED);
    this.cdc.onFinishScenario(scenario);
    this.cdc.onFinishTest();
    const json = JSON.parse(this.cdc.getOutput());
    assertCucumberJson(json, [
      statuses.PASSED,
      statuses.FAILED,
      statuses.SKIPPED
    ]);
  });

  it("handles missing steps", () => {
    this.cdc.onStartScenario(scenario, stepsToRun);
    this.cdc.onStartStep(stepsToRun[0]);
    this.cdc.onFinishStep(stepsToRun[0], statuses.PASSED);
    this.cdc.onStartStep(stepsToRun[1]);
    try {
      expect(this.cdc.onMissingStep(stepsToRun[1])).to.throw(
        Error,
        "Step implementation missing for I run cypress tests"
      );
    } catch (e) {
      // this is expected
    }
    this.cdc.onFinishTest();
    const json = JSON.parse(this.cdc.getOutput());
    assertCucumberJson(json, [
      statuses.PASSED,
      statuses.UNDEFINED,
      statuses.SKIPPED
    ]);
  });
});
