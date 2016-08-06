/* global module require */
/* eslint-env node */
"use strict";

// Minimal localConfig if there is not one locally.
var localConfig = {
  browserStack: {},
};
try {
  // eslint-disable-next-line import/no-unresolved, global-require
  localConfig = require("./localConfig");
}
catch (ex) {} // eslint-disable-line no-empty

module.exports = function configure(config) {
  config.set({
    basePath: "",
    frameworks: ["requirejs", "mocha"],
    files: [
      "test/karma-main.js",
      { pattern: "index.js", included: false },
      { pattern: "test/**/!(commonjs).js", included: false },
      { pattern: "node_modules/bluejax.try/dist/bluejax.try.*",
        included: false },
      { pattern: "node_modules/jquery/dist/jquery.js", included: false },
      { pattern: "node_modules/bluebird/js/browser/bluebird.js",
        included: false },
      { pattern: "node_modules/chai/chai.js", included: false },
      { pattern: "node_modules/chai-as-promised/lib/chai-as-promised.js", included: false },
      { pattern: "node_modules/sinon/lib/**/*.js", included: false },
    ],
    exclude: [
    ],
    client: {
      mocha: {
        asyncOnly: true,
      },
    },
    preprocessors: {
      "test/**/!(karma-main).js": ["babelModule"],
      "test/karma-main.js": ["babel"],
      "index.js": ["coverage"],
    },
    customPreprocessors: {
      babelModule: {
        base: "babel",
        options: {
          plugins: ["transform-es2015-modules-amd"],
        },
      },
    },
    babelPreprocessor: {
      options: {
        presets: ["es2015"],
        sourceMap: "inline",
      },
      filename: function filename(file) {
        return file.originalPath.replace(/\.js$/, ".es5.js");
      },
      sourceFileName: function sourceFileName(file) {
        return file.originalPath;
      },
    },
    reporters: ["progress", "coverage"],
    coverageReporter: {
      reporters: [
        { type: "html" },
        { type: "json" },
      ],
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["Chrome", "Firefox"],
    browserStack: {
      username: localConfig.browserStack.username,
      accessKey: localConfig.browserStack.accessKey,
      project: "bluejax",
    },
    customLaunchers: {
      ChromeWin: {
        base: "BrowserStack",
        browser: "Chrome",
        os: "Windows",
        os_version: "10",
      },
      FirefoxWin: {
        base: "BrowserStack",
        browser: "Firefox",
        os: "Windows",
        os_version: "10",
      },
      IE11: {
        base: "BrowserStack",
        browser: "IE",
        browser_version: "11",
        os: "Windows",
        os_version: "10",
      },
      IE10: {
        base: "BrowserStack",
        browser: "IE",
        browser_version: "10",
        os: "Windows",
        os_version: "8",
      },
      Edge: {
        base: "BrowserStack",
        browser: "Edge",
        os: "Windows",
        os_version: "10",
      },
      Opera: {
        base: "BrowserStack",
        browser: "Opera",
        os: "Windows",
        os_version: "10",
      },
      SafariElCapitan: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "El Capitan",
      },
      SafariYosemite: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "Yosemite",
      },
      SafariMavericks: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "Mavericks",
      },
    },
    singleRun: false,
  });
};
