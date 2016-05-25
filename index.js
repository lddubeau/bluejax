/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2016 Louis-Dominique Dubeau
 */
/* global define module require */
(function boot(root, factory) {
  "use strict";

  if (typeof define === "function" && define.amd) {
    define(["jquery", "bluebird"], factory);
  }
  else if (typeof module === "object" && module.exports) {
    // eslint-disable-next-line global-require
    module.exports = factory(require("jquery"), require("bluebird"));
  }
  else {
    /* global jQuery Promise */
    root.bluejax = factory(jQuery, { Promise: Promise });
  }
}(this, function factory($, bluebird) {
  "use strict";

  var Promise = bluebird.Promise;

  function inherit(inheritor, inherited) {
    inheritor.prototype = Object.create(inherited.prototype);
    inheritor.prototype.constructor = inheritor;
  }

  function rename(cls) {
    cls.prototype.name = cls.name;
  }

  function GeneralAjaxError(jqXHR, textStatus, errorThrown, options) {
    this.jqXHR = jqXHR;
    this.textStatus = textStatus;
    this.errorThrown = errorThrown;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    else {
      this.stack = (new Error()).stack;
    }

    var message = "Ajax operation failed";
    if (errorThrown) {
      message += ": " + errorThrown + " (" + jqXHR.status + ")";
    }
    else if (textStatus) {
      message += ": " + textStatus;
    }
    message += ".";

    if (options) {
      message += " Called with: " + JSON.stringify(options);
    }

    this.message = message;
  }

  inherit(GeneralAjaxError, Error);
  rename(GeneralAjaxError);

  //
  // The possible values of textStatus are: "success", "notmodified",
  // "nocontent", "error", "timeout", "abort", or "parsererror"
  //
  // "success" or "notmodified" cannot be values here because they are
  // successes.
  //
  // We do not create a more specialized error class for nocontent because
  // that's a kind of buggy state anyway. See:
  // https://bugs.jquery.com/ticket/13654
  //
  var names = ["timeout", "abort", "parsererror", "ajax", "http"];
  var statusToError = {};
  var errors = {};

  for (var i = 0; i < names.length; ++i) {
    var name = names[i];
    var origName = name;
    if (name !== "parsererror") {
      name = name[0].toUpperCase() + name.slice(1) + "Error";
    }
    else {
      // The default code would yield ParsererrorError...
      name = "ParserError";
    }

    // eslint-disable-next-line func-names
    var cls = function () {
      GeneralAjaxError.apply(this, arguments);
    };

    // We cannot just assign to name.
    Object.defineProperty(cls, "name", { value: name });

    statusToError[origName] = cls;
    errors[name] = cls;
    inherit(cls, GeneralAjaxError);
    rename(cls);
  }

  function makeError(jqXHR, textStatus, errorThrown, options) {
    var Constructor = statusToError[textStatus];

    if (!Constructor) {
      Constructor = statusToError[(jqXHR.status !== 0) ? "http" : "ajax"];
    }

    return new Constructor(jqXHR, textStatus, errorThrown, options);
  }

  function ConnectivityError(message,
                             original) {
    GeneralAjaxError.call(this);
    this.message = message;
    this.originalError = original;
  }

  errors.ConnectivityError = ConnectivityError;
  inherit(ConnectivityError, GeneralAjaxError);
  rename(ConnectivityError);

  function BrowserOfflineError(original) {
    ConnectivityError.call(this, "your browser is offline", original);
  }

  errors.BrowserOfflineError = BrowserOfflineError;
  inherit(BrowserOfflineError, ConnectivityError);
  rename(BrowserOfflineError);

  function ServerDownError(original) {
    ConnectivityError.call(this, "the server appears to be down", original);
  }

  errors.ServerDownError = ServerDownError;
  inherit(ServerDownError, ConnectivityError);
  rename(ServerDownError);

  function NetworkDownError(original) {
    ConnectivityError.call(this, "the network appears to be down", original);
  }

  errors.NetworkDownError = NetworkDownError;
  inherit(NetworkDownError, ConnectivityError);
  rename(NetworkDownError);

  var defaultOptions = {};

  function extractBluejaxOptions(args) {
    var bluejaxOptions;
    var cleanedOptions;
    var first = args[0];
    if (args.length === 1) {
      if (typeof first !== "object") {
        cleanedOptions = { url: first };
      }
      else {
        cleanedOptions = $.extend({}, first);
      }
    }
    else if (args.length === 2) {
      var second = args[1];
      cleanedOptions = $.extend({}, second);
      cleanedOptions.url = first;
    }

    bluejaxOptions = cleanedOptions.bluejaxOptions;
    if (bluejaxOptions) {
      // We combine defaultOptions with bluejaxOptions.
      bluejaxOptions = $.extend({}, defaultOptions, bluejaxOptions);
      delete cleanedOptions.bluejaxOptions;
    }
    else {
      bluejaxOptions = defaultOptions;
    }

    return [bluejaxOptions, cleanedOptions];
  }

  // For the ``ajax()`` function cannot use:
  //
  // return Promise.resolve($.ajax.apply($.ajax, arguments))
  //     .catch(function (e) {
  //        throw new GeneralAjaxError(e.jqXHR, e.textStatus, e.errorThrown);
  //      });
  //
  // Because what is passed to ``.catch`` is the ``jqXHR`` (so the
  // code above cannot work). ``textStatus`` and ``errorThrown`` are
  // lost.
  //
  // We furthermore cannot use:
  //
  // return Promise.resolve(
  //        $.ajax.apply($.ajax, arguments)
  //            .fail(function (...) {
  //                throw new GeneralAjaxError(...);
  //            }));
  //
  // Because there exist conditions under which $.ajax will fail
  // immediately, call the ``.fail`` handler immedidately and cause
  // the exception to be raised before ``Promise.resolve`` has been
  // given a chance to work. This means that some ajax errors won't
  // be catchable through ``Promise.catch``.
  //

  function dedupURL(url) {
    url += (url.indexOf("?") < 0) ? "?" : "&_=";
    return url + Date.now();
  }

  function normalizeURL(url) {
    if (url[url.length - 1] === "/" && url.indexOf("?") < 0) {
      url += "favicon.ico";
    }

    return url;
  }

  function connectionCheck(error, diagnose) {
    // Server cannot be reached. Try to get a clearer picture...

    var servers = diagnose.knownServers;
    if (!servers || servers.length === 0) {
      return Promise.reject(new ServerDownError(error));
    }

    return Promise.all(servers.map(function urlToAjax(url) {
      // eslint-disable-next-line no-use-before-define
      return ajax({ url: dedupURL(normalizeURL(url)), timeout: 1000 })
        .reflect();
    })).filter(function filterSuccessfulServers(result) {
      return result.isFulfilled();
    }).then(function checkAnyFullfilled(fulfilled) {
      if (fulfilled.length === 0) {
        throw new NetworkDownError(error);
      }
      throw new ServerDownError(error);
    });
  }


  function diagnoseIt(error, diagnose) {
    // Try to diagnose the issue...

    if (("onLine" in navigator) && !navigator.onLine) {
      throw new BrowserOfflineError(error);
    }

    var serverURL = diagnose.serverURL;
    return (serverURL ?
            // We have a server to check, so check it.
            // eslint-disable-next-line no-use-before-define
            ajax({ url: dedupURL(normalizeURL(serverURL)) })
            .catch(function failed() {
              return connectionCheck(error, diagnose);
            }) :
            // Otherwise we just check the connection
            connectionCheck(error, diagnose))
      .then(function success() {
        // The test passed... and we have no tries left, just rethrow what we
        // would have thrown in the first place.
        throw error;
      });
  }

  function isNetworkIssue(error) {
    // We don't want to retry when a HTTP error occurred.
    return !(error instanceof errors.HttpError) &&
      !(error instanceof errors.ParserError) &&
      !(error instanceof errors.AbortError);
  }

  function doit(originalArgs, jqOptions, bjOptions, tries) {
    var xhr = $.ajax(jqOptions);
    var p = new Promise(function resolver(resolve, reject) {
      function succeded(data, textStatus, jqXHR) {
        resolve(bjOptions.verboseResults ? [data, textStatus, jqXHR] : data);
      }

      function failed(jqXHR, textStatus, errorThrown) {
        var error = makeError(
          jqXHR, textStatus, errorThrown,
          bjOptions.verboseExceptions ? originalArgs : null);

        if (!isNetworkIssue(error)) {
          reject(error);
        }
        else if (tries > 1) {
          resolve(Promise.delay(bjOptions.delay).then(
            doit.bind(this, originalArgs, jqOptions, bjOptions, tries - 1)));
        }
        else {
          var diagnose = bjOptions.diagnose;
          if (!diagnose || !diagnose.on) {
            reject(error);
          }
          else {
            // We cannot just call reject with the return value of diagnoseIt,
            // as the rejection value would be a promise and not an
            // error. (resolve assimilates promises, reject does not).
            resolve(diagnoseIt(error, diagnose));
          }
        }
      }

      xhr.fail(failed).success(succeded);
    });

    return bjOptions.provideXHR ? { xhr: xhr, promise: p } : p;
  }

  function _ajax(url, settings, override) {
    var originalArgs = settings ? [url, settings] : [url];
    var extracted = extractBluejaxOptions(originalArgs);
    var bluejaxOptions = $.extend({}, override, extracted[0]);
    var cleanedOptions = extracted[1];
    return doit(originalArgs, cleanedOptions, bluejaxOptions,
                bluejaxOptions.tries);
  }

  function ajax(url, settings) {
    return _ajax(url, settings);
  }

  function make(options) {
    return function customAjax(url, settings) {
      return _ajax(url, settings, options);
    };
  }

  function setDefaultOptions(opts) {
    defaultOptions = opts;
  }

  function getDefaultOptions() {
    return defaultOptions;
  }

  var exports = {
    ajax: ajax,
    GeneralAjaxError: GeneralAjaxError,
    make: make,
    setDefaultOptions: setDefaultOptions,
    getDefaultOptions: getDefaultOptions,
  };

  // semver-sync detects an assignment to `exports.version` and uses the string
  // literal for matching. Messing with this line could make semver-sync fail.
  exports.version = "0.1.1";

  // Export the errors
  for (var x in errors) { // eslint-disable-line guard-for-in
    exports[x] = errors[x];
  }

  return exports;
}));
