/* global window describe it before beforeEach afterEach setTimeout */
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
// This import will work in testing.
// eslint-disable-next-line import/no-unresolved
import bluejax from "bluejax";
import Promise from "bluebird";

chaiAsPromised.transferPromiseness = (assertion, promise) => {
  assertion.then = promise.then.bind(promise);
  assertion.return = promise.return.bind(promise);
  assertion.catch = promise.catch.bind(promise);
};

chai.use(chaiAsPromised);
const assert = chai.assert;

const ajax = bluejax.ajax;
const ajax$ = bluejax.make({ verboseResults: true });

function checkOpenCall(call, serverURL) {
  assert.equal(call[0], "GET", "the call should be a GET request");
  const startsWith = `${serverURL}favicon.ico?`;
  assert.isTrue(call[1].indexOf(startsWith, 0) === 0,
                "the call should have requested the server URL with " +
                `favicon.ico? appended (${call[1]} does not begin with ` +
                `${startsWith})`);
}

describe("", () => {
  let xhr;
  let onLine = true;
  const url = "http://www.example.com";
  const something = [200, { "Content-Type": "application/html" }, "something"];
  const error = [500, { "Content-Type": "application/html" }, "error"];


  let nextResponses = [];
  let requests = [];
  before(() => {
    Object.defineProperty(window.navigator.constructor.prototype, "onLine", {
      get: function getOnline() {
        return onLine;
      },
    });
  });
  beforeEach(() => {
    nextResponses = [something];
    requests = [];
    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = request => {
      requests.push(request);
      setTimeout(() => {
        const nextResponse = nextResponses.shift();
        if (nextResponse) {
          if (nextResponse === "abort") {
            //
            // We have to set statusText ourselves due to a bug
            // in Sinon 1.17.4.
            //
            // With Sinon 1.17.3 both statusText and readyState had to be set
            // (request.readyState = sinon.FakeXMLHttpRequest.UNSENT).
            //

            request.statusText = "abort";
            request.abort();
          }
          else if (nextResponse === "error") {
            request.abort();
            request.statusText = "error";
          }
          else {
            request.respond.apply(request, nextResponse);
          }
        }
      }, 1);
    };

    onLine = true;
  });

  afterEach(() => {
    if (xhr) xhr.restore();
    bluejax.setDefaultOptions({});
  });

  describe("ajax", () => {
    it("should pass data on success", () =>
       assert.eventually.equal(ajax(url), "something"));

    it("should throw a proper HttpError on failure", () => {
      nextResponses = [error];
      return assert.isRejected(ajax(url)).then(err => {
        assert.equal(err.constructor, bluejax.HttpError);
        assert.equal(
          err.toString(),
          "HttpError: Ajax operation failed: Internal Server Error (500).");
        assert.isDefined(err.jqXHR);
        assert.equal(err.textStatus, "error");
        assert.equal(err.errorThrown, "Internal Server Error");
      });
    });

    it("should throw a verbose error when the option " +
       "verboseExceptions is true", () => {
      nextResponses = [error];
      const opts = {
        url,
        bluejaxOptions: {
          verboseExceptions: true,
        },
      };
      return assert.isRejected(ajax(opts)).then(err => {
        assert.equal(err.constructor, bluejax.HttpError);
        assert.equal(
          err.toString(),
          "HttpError: Ajax operation failed: Internal Server " +
          `Error (500). Called with: ${JSON.stringify([opts])}`);
        assert.isDefined(err.jqXHR);
        assert.equal(err.textStatus, "error");
        assert.equal(err.errorThrown, "Internal Server Error");
      });
    });

    it("should throw a verbose error when defaultOptions." +
       "verboseExceptions is true", () => {
      bluejax.setDefaultOptions({ verboseExceptions: true });
      nextResponses = [error];
      const opts = { url };
      return assert.isRejected(ajax(opts)).then(err => {
        assert.equal(err.constructor, bluejax.HttpError);
        assert.equal(
          err.toString(),
          "HttpError: Ajax operation failed: Internal Server " +
          `Error (500). Called with: ${JSON.stringify([opts])}`);
        assert.isDefined(err.jqXHR);
        assert.equal(err.textStatus, "error");
        assert.equal(err.errorThrown, "Internal Server Error");
      });
    });

    it("should reject immediately if tries === 0", () => {
      nextResponses = [error];
      return assert.isRejected(ajax(url))
        .then(() => assert.equal(requests.length, 1));
    });

    it("should reject immediately on HTTP errors", () => {
      nextResponses = [error];
      return assert.isRejected(ajax(url, {
        bluejaxOptions: {
          tries: 3,
          delay: 10,
        },
      })).then(() => assert.equal(requests.length, 1));
    });

    it("should retry on timeouts", () => {
      nextResponses = [];
      return assert.isRejected(
        ajax(url, { timeout: 10,
                    bluejaxOptions: {
                      tries: 3,
                      delay: 10,
                    },
                  }))
        .then(err => {
          assert.equal(err.constructor, bluejax.TimeoutError);
          assert.equal(err.textStatus, "timeout");
          assert.equal(requests.length, 3);
        });
    });

    it("should reject immediately with AbortError when aborting", () => {
      nextResponses = ["abort"];
      return assert.isRejected(ajax(url, {
        bluejaxOptions: {
          tries: 3,
          delay: 10,
        },
      })).then(err => {
        assert.equal(err.constructor, bluejax.AbortError);
        assert.equal(err.textStatus, "abort");
        assert.equal(requests.length, 1);
      });
    });

    it("should reject immediately with a ParserError when there " +
       "is a parsing error", () => {
      nextResponses = [[200, { "Content-Type": "text/json" }, "</q>"]];
      return assert.isRejected(ajax(url, { dataType: "json",
        bluejaxOptions: {
          tries: 3,
          delay: 10,
        },
      }))
        .then(err => {
          assert.equal(err.constructor, bluejax.ParserError);
          assert.equal(err.textStatus, "parsererror");
          assert.equal(requests.length, 1);
        });
    });

    it("should retry when requested and retrying can happen", () => {
      xhr.restore();
      xhr = null;

      // Force the requests to fail.
      const stub = sinon.stub(window.XMLHttpRequest.prototype, "open");
      stub.throws();
      return assert.isRejected(ajax("http://example.com:80", {
        bluejaxOptions: {
          tries: 3,
          delay: 10,
        },
      }))
        .then(() => assert.equal(stub.callCount, 3))
        .finally(() => stub.restore());
    });

    it("should test the server when requested: offline", () => {
      xhr.restore();
      xhr = null;

      // Force the requests to fail.
      const stub = sinon.stub(window.XMLHttpRequest.prototype, "open");
      stub.throws();
      onLine = false;
      return assert.isRejected(ajax("http://example.com:80", {
        bluejaxOptions: {
          tries: 3,
          delay: 10,
          diagnose: {
            on: true,
            serverURL: "http://localhost:1025/",
          },
        },
      })).then(err => {
        // Check the error itself.
        assert.equal(err.constructor, bluejax.BrowserOfflineError);
        assert.equal(err.message, "your browser is offline");
        assert.equal(err.originalError.constructor, bluejax.AjaxError);

        // We tried 3 times and then found the browser offline.
        assert.equal(stub.callCount, 3);
      }).finally(() => stub.restore());
    });

    it("should test the server when requested: online", () => {
      xhr.restore();
      xhr = null;

      // Force the requests to fail.
      const stub = sinon.stub(window.XMLHttpRequest.prototype, "open");
      stub.throws();
      return assert.isRejected(ajax("http://example.com:80", {
        bluejaxOptions: {
          tries: 3,
          delay: 10,
          diagnose: {
            on: true,
            serverURL: "http://localhost:1025/",
          },
        },
      })).then(err => {
        // Check the error itself.
        assert.equal(err.constructor, bluejax.ServerDownError);
        assert.equal(err.message, "the server appears to be down");
        assert.equal(err.originalError.constructor, bluejax.AjaxError);

        // We tried 3 times and then tried diagnosing.
        assert.equal(stub.callCount, 4);

        // Check that the last call was to the serverURL
        checkOpenCall(stub.args[3], "http://localhost:1025/");
      }).finally(() => stub.restore());
    });

    it("should report a down network when no knownServers can be reached ",
       () => {
         xhr.restore();
         xhr = null;

         // Force the requests to fail.
         const stub = sinon.stub(window.XMLHttpRequest.prototype, "open");
         stub.throws();
         const knownServers = [
           "http://www.google.com/",
           "http://www.cloudfront.com/",
         ];
         return assert.isRejected(ajax("http://example.com:80", {
           bluejaxOptions: {
             tries: 3,
             delay: 10,
             diagnose: {
               on: true,
               serverURL: "http://localhost:1025/",
               knownServers,
             },
           },
         })).then(err => {
           // Check the error itself.
           assert.equal(err.constructor, bluejax.NetworkDownError);
           assert.equal(err.message, "the network appears to be down");
           assert.equal(err.originalError.constructor, bluejax.AjaxError);

           // We tried 3 times and then tried diagnosing.
           assert.equal(stub.callCount, 6);

           // Check that the 1st call after the 3 tries was to the serverURL.
           const serverCall = stub.args[3];
           checkOpenCall(serverCall, "http://localhost:1025/");

           const networkCalls = stub.args.slice(4);
           for (let i = 0; i < networkCalls.length; ++i) {
             checkOpenCall(networkCalls[i], knownServers[i]);
           }
         }).finally(() => stub.restore());
       });

    it("should report a down server when knownServers can be reached ",
       () => {
         // Force the requests to fail.
         const spy = sinon.spy(window.XMLHttpRequest.prototype, "open");

         nextResponses = ["error", something, something];
         const knownServers = [
           "http://www.google.com/",
           "http://www.cloudfront.com/",
         ];
         return assert.isRejected(ajax("http://example.com:80", {
           bluejaxOptions: {
             diagnose: {
               on: true,
               knownServers,
             },
           },
         })).then(err => {
           // Check the error itself.
           assert.equal(err.constructor, bluejax.ServerDownError);
           assert.equal(err.message, "the server appears to be down");
           assert.equal(err.originalError.constructor, bluejax.AjaxError);

           // We tried once and then tried diagnosing.
           assert.equal(spy.callCount, 3);

           const networkCalls = spy.args.slice(1);
           for (let i = 0; i < networkCalls.length; ++i) {
             checkOpenCall(networkCalls[i], knownServers[i]);
           }
         }).finally(() => spy.restore());
       });
  });

  describe("ajax with verboseResults", () => {
    it("should pass data, textStatus and jqXHR on success", () =>
       ajax$(url).spread((data, textStatus, jqXHR) => {
         assert.equal(data, "something");
         assert.equal(textStatus, "success");
         assert.isDefined(jqXHR);
       }));

    it("should throw a proper error on failure", () => {
      nextResponses = [error];
      return assert.isRejected(ajax$(url)).then(err => {
        assert.equal(err.constructor, bluejax.HttpError);
        assert.equal(
          err.toString(),
          "HttpError: Ajax operation failed: Internal Server Error (500).");
        assert.isDefined(err.jqXHR);
        assert.equal(err.textStatus, "error");
        assert.equal(err.errorThrown, "Internal Server Error");
      });
    });

    it("should throw a verbose error when the option " +
       " verboseExceptions is true", () => {
      nextResponses = [error];
      const opts = {
        url,
        bluejaxOptions: {
          verboseExceptions: true,
        },
      };
      return assert.isRejected(ajax$(opts)).then(err => {
        assert.equal(err.constructor, bluejax.HttpError);
        assert.equal(
          err.toString(),
          "HttpError: Ajax operation failed: Internal Server " +
          `Error (500). Called with: ${JSON.stringify([opts])}`);
        assert.isDefined(err.jqXHR);
        assert.equal(err.textStatus, "error");
        assert.equal(err.errorThrown, "Internal Server Error");
      });
    });
  });

  describe("ajax with provideXHR true", () => {
    it("should return the jqXHR", () => {
      const { xhr: myXhr, promise: myPromise } = ajax(url, {
        bluejaxOptions: {
          provideXHR: true,
          verboseResults: true,
        },
      });

      return assert.eventually.deepEqual(myPromise,
                                         ["something", "success", myXhr]);
    });
  });

  describe("AjaxError", () => {
    it("should use textStatus if errorThrown is not set", () => {
      nextResponses = ["abort"];
      return assert.isRejected(ajax(url)).then(err => {
        assert.equal(err.constructor, bluejax.AbortError);
        assert.equal(err.toString(),
                     "AbortError: Ajax operation failed: abort (0).");
        assert.isDefined(err.jqXHR);
        assert.equal(err.textStatus, "abort");
        assert.equal(err.errorThrown, "abort");
      });
    });

    it("should have a good message if errorThrown and textStatus are " +
       "not set",
      () => {
        assert.equal(new bluejax.AjaxError().toString(),
                     "AjaxError: Ajax operation failed.");
        return Promise.resolve(1); // Keep mocha happy.
      });
  });
});
