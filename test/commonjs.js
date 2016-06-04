/* global __dirname describe it setTimeout */
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import jsdom from "jsdom";
import { Promise } from "bluebird";

chaiAsPromised.transferPromiseness = (assertion, promise) => {
  assertion.then = promise.then.bind(promise);
  assertion.return = promise.return.bind(promise);
  assertion.catch = promise.catch.bind(promise);
};

chai.use(chaiAsPromised);
const assert = chai.assert;

class JSDom {
  constructor(scripts) {
    this.window = undefined;
    this.log_buffer = [];
    this.scripts = scripts;
  }

  create() {
    // vc is useful for debugging.
    const vc = jsdom.createVirtualConsole();
    vc.on("log", console.log); // eslint-disable-line no-console
    vc.on("jsdomError", err => {
      throw err;
    });
    return new Promise(
      (resolve, _reject) =>
        jsdom.env({
          html: "",
          url: `file://${__dirname}`,
          features: {
            FetchExternalResources: ["script"],
            ProcessExternalResources: ["script"],
          },
          scripts: this.scripts,
          virtualConsole: vc,
          done: (error, w) => {
            assert.isNull(error, `window creation failed with error: ${error}`);
            this.window = w;
            resolve(this);
          },
        }));
  }
}

// The AMD case is tested above...
describe("loads", () => {
  function checkDefinitions(bluejax) {
    assert.isDefined(bluejax.ajax);
    assert.isDefined(bluejax.make);
    assert.isDefined(bluejax.AjaxError);
    assert.isDefined(bluejax.try);
  }

  // eslint-disable-next-line global-require
  it("in CommonJS", () => checkDefinitions(require("../index.js")));

  it("through script tags", () =>
     new JSDom([
       "node_modules/jquery/dist/jquery.js",
       "node_modules/bluebird/js/browser/bluebird.js",
       "node_modules/bluejax.try/dist/bluejax.try.min.js",
       "index.js",
     ]).create().then(jd => checkDefinitions(jd.window.bluejax)));
});
