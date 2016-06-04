const allTestFiles = [];
const TEST_REGEXP = /test\/(?!karma-main).*\.js$/i;

Object.keys(window.__karma__.files).forEach((file) => {
  if (TEST_REGEXP.test(file)) {
    const normalizedTestModule = file.replace(/^\/base\/|\.js$/g, "");
    allTestFiles.push(normalizedTestModule);
  }
});

require.config({
  baseUrl: "/base",
  paths: {
    jquery: "node_modules/jquery/dist/jquery",
    bluebird: "node_modules/bluebird/js/browser/bluebird",
    bluejax: "index",
    "bluejax.try": "node_modules/bluejax.try/dist/bluejax.try",
    chai: "node_modules/chai/chai",
    "chai-as-promised": "node_modules/chai-as-promised/lib/chai-as-promised",
    sinon: "node_modules/sinon/lib/sinon",
  },
  deps: allTestFiles,
  callback: window.__karma__.start,
});
