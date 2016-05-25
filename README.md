Bluejax is a library that wraps jQuery's
[``ajax``](https://api.jquery.com/jquery.ajax/) function in [Bluebird
promises](http://bluebirdjs.com/docs/getting-started.html). This is not the
first library of this kind, but the other libraries that existed when Bluejax
was created did not satisfy our needs, or appeared defunct.

Features
========

* Wraps ``jQuery.ajax`` in Bluebird promises.

* Optionally retry failed queries a number of times before giving up.

* Optionally diagnoses failed queries: network failure, server down, something
  else?

Loading Bluejax
===============

AMD
---

Your loader should be configured so that it can find Bluejax, jQuery
and Bluebird. jQuery and Bluebird are requested by Bluejax as
``jquery`` and ``bluebird`` respectively.

CommonJS
--------

Once installed, you should just be able to do ``var bluejax =
require("bluejax")``. jQuery and Bluebird should also be installed. Just like in
the AMD case, they are required as ``jquery`` and ``bluebird`` respectively.

``script`` elements
-------------------

If you are just loading it in a browser with ``script``. jQuery and
Bluebird must have been loaded beforehand.

Using Bluejax
=============

The module exports these objects:

* ``ajax(...)`` is a function that passes all its arguments to
  ``jQuery.ajax``. By default, it returns a promise that resolves to the data
  received. If it fails, it will reject the promise with a ``GeneralAjaxError``
  or a derived exception class.

      ajax(url).then(function (data) {
          document.getElementById("foo").innerHTML = data;
      });

* ``make(options)`` is a utility function that creates a new ``ajax``-like
  function. The ``options`` parameter is an object containing Bluejax
  options. The returned value is a new function that works like ``ajax`` but
  which has its Bluejax options set to the values contained in the ``options``
  object.

  Example: it is possible to create a new function that will return verbose
  results: ``var ajax$ = make({verboseResults: true});`` and use it in the same
  way ``ajax`` is used:

        ajax$("http://example.com").spread(function (data, textStatus, jqXHR) {
           ...
        });

* ``GeneralAjaxError`` is a class that derives from JavaScript's stock
  ``Error``. It aims to provide a somewhat saner way to handle Ajax errors than
  what jQuery provides by default. When ``jQuery.ajax`` fails, Bluejax creates
  an exception derived from ``GeneralAjaxError`` that has its ``jqXHR``,
  ``textStatus`` and ``errorThrown`` fields set to the corresponding fields of
  callback that should be passed to the ``.fail(...)`` method of the object
  returned by ``jQuery.ajax``. Its ``message`` field is constructed as follows:

    * If ``errorThrown`` is set, the message is "Ajax operation
      failed: ``errorThrown`` (``jqXHR.status``).".

    * Otherwise, if ``textStatus`` is set, the message is "Ajax
      operation failed: ``textStatus``.".

    * Otherwise, the message is "Ajax operation failed."

* ``HttpError`` is raised if the response had an HTTP status that signaled an
  error.

* ``TimeoutError`` is raised if the rejection was caused by a timeout.

* ``AbortError`` is raised if the rejection was caused by an abort.

* ``ParserError`` is raised if the rejection was caused by a parsing problem.

* ``ConnectivityError`` indicates a network problem. This class of error is
  never raised directly but is raised through its children:

  + ``BrowserOfflineError`` is raised if the browser is offline.

  + ``ServerDownError`` is raised if the server is down.

  + ``NetworkDownError`` is raised if the network is down.

* If none of the more specialized cases above apply, then ``AjaxError`` is
  raised.

* ``setDefaultOptions(options)`` Bluejax's options globally. The object passed
  should not be modified further after the call.

* ``getDefaultOptions()`` returns the options currently in effect. The object
  returned should not be modified. Clone it if you need to modify it.

Options
-------

Bluejax currently supports:

* ``tries`` tells Bluejax to retry the query for a number of times if it fails
  due to reasons **other** than the HTTP status code reports an error, aborted
  or had a parser error. Basically, it retries the connection if the issue
  appears to be at the network level rather than an application issue. Note that
  the value here should be a number greater than 1. (Values less than 1 yield
  undefined behavior.)

* ``delay`` specifies the delay between retries, in milliseconds.

* ``diagnose`` is an object with the following keys:

    * ``on`` must be ``true`` for diagnosis to happen. (This makes diagnosis
      easy to turn off, while keeping the other diagnosis settings intact.)
      **Make sure to read the section on diagnosis rules and URL transformations
      below before to understand what it is that happens when you turn diagnosis
      on!!!**

    * ``serverURL`` must be a URL that used to test whether your server is
      running or not. We recommend making it a path that is inexpensive to
      serve. For instance, your internet-facing nginx instance could have a rule
      that serves 200 and no contents for GETs to ``/ping``. Bluejax uses this
      URL to double check whether your server is up.

    * ``knownServers`` must be an array of URLs to known internet
      servers. Bluejax uses these URLs to determine whether the Internet is
      accessible or not.

* ``verboseExceptions`` when set to ``true`` will cause exception messages to
  additionally contain the text "Called with: " followed by a JSON dump of the
  options that were passed to ``ajax(...)``. This can be useful to identify
  which call precisely is failing.

* ``verboseResults`` causes the promise to resolve to ``[data, textStatus,
  jqXHR]`` where each element of the array is the corresponding parameter passed
  to the callback of the ``.done(...)`` method of the object returned by
  ``jQuery.ajax``. You would use this in a case where just receiving ``data`` is
  not enough for your usage scenario.

  Bluebird's ``.spread`` method is useful to unpack the array:

       ajax(url, {
                 bluejaxOptions: { verboseResults: true }
            }).spread(function (data, textStatus, jqXHR) {...


* ``provideXHR`` causes ``ajax`` to *return* an object with the keys ``xhr`` and
  ``promise``. **Take note that with this option, the *return* value changes.**
  The ``xhr`` key is set to the return value of ``jQuery.ajax`` and ``promise``
  is set to the promise that ``ajax`` normally returns. This option is useful if
  you need to grab a reference to the return value of ``jQuery.ajax``. For
  instance, if you need to be able to abort the Ajax operation.

There are three ways to set Bluejax options:

* You can set set the ``bluejaxOptions`` field on a settings object passed to
  ``ajax``. Remember that ``ajax(...)`` takes the same parameters as
  ``jQuery.ajax``. When you pass a ``settings`` parameter to the call, it may
  contain a ``bluejaxOptions`` field that sets ``verboseExceptions``:

      bluejax.ajax({
          url: "http://example.com",
          bluejaxOptions: {
              verboseExceptions: true
          }
      });

* You can create a new ``ajax``-like function with ``make``.

* You can set options globally by using ``setDefaultOptions(...)``. So you could
  turn on verbose exceptions for all calls with:

      bluejax.setDefaultOptions({
          verboseExceptions: true
      });

  The options passed to ``ajax(...)`` override those passed to
  ``setDefaultOptions()``.

  **There are options that should not be changed using this method. For instance
    ``verboseResults`` would entail changing the value to which the promises
    returned by ``ajax`` resolve. This would most likely break code.** Bluejax
    won't prevent you from shooting you in the foot.

Diagnosis Rules
===============

Diagnosis happens only if the final try for the request failed with an error
other than an HTTP error, an abort or a parser error. Otherwise, no diagnosis
occurs and the error is reported immediately.

Bluejax uses the following rules when diagnosis is requested:

1. If ``navigator.onLine`` is false, Bluejax reports that the browser is
   offline.

2. If a ``serverURL`` is specified, then it checks whether the server is
   responds to a GET at this URL:

  A. If the server responds, Bluejax reports the error that was reported by the
    last try.

  B. If the server does not respond, Bluejax reports the result of a
     connectivity check.

3. If a ``serverURL`` was not specified, Bluejax reports the result of a
   connectivity check.

Connectivity Check
------------------

1. If ``knownServers`` does not exist or is an empty list, then it reports that
   the server appears to be down.

2. Otherwise, Bluejax contacts all the servers. If none of them respond, then it
   reports that the network appears to be down. Otherwise, it reports that the
   server appears to be down.

URL Checking Rules
------------------

For all URLs used in diagnosis, these two transformations are applied in order:

1. If the URL ends with a `/` and has no query string, then the URL is
   transformed by adding `favicon.ico`. Requesting the root page of a site may
   result in a large amount of data being returned. Requesting `favicon.ico`
   would in most cases result in a relatively small amount of data.

2. If the URL has no query, then the URL is transformed by adding a query that
   is a single number corresponding to the current time. This is done to bust
   caches.

So if you specify a known server as ``http://www.google.com/`` the URL used for
the query will be ``http://www.google.com/favicon.icon?ttttt``, where ``ttttt```
is the number described above. If you specify ``http://www.example.com/foo``
then the URL used for the query will be ``http://www.example.com/foo?ttttt``. If
the URL you give in the options contains a query, it won't be modified **at
all**. (We do not recommend such case.)

Developing Bluejax
==================

If you produce a pull request run ``gulp lint`` and ``gulp test`` first to make
sure they run clean. If you add features, do add tests.

Coverage
--------

We need a Mocha run to test loading Bluejax as a CommonJS module with ``script``
elements. The Karma run, which exercises over 95% of the code, uses RequireJS
to load Bluejax.

Ideally, we combine the results of the Karma runs with the result of the Mocha
run. The problem though is that as we speak, ``karma-coverage`` uses Istanbul
0.4.x but to get coverage with Mocha with code that has run through Babel, we
need Istanbul 1.0.0-alpha2 or higher. We've not been able to combine the formats
produced by the various versions.

#  LocalWords:  Bluejax jQuery's ajax jQuery jquery CommonJS bluejax url jqXHR
#  LocalWords:  GeneralAjaxError getElementById innerHTML verboseResults nginx
#  LocalWords:  textStatus errorThrown HttpError TimeoutError AbortError GETs
#  LocalWords:  ParserError ConnectivityError BrowserOfflineError AjaxError xhr
#  LocalWords:  ServerDownError NetworkDownError setDefaultOptions Bluejax's
#  LocalWords:  getDefaultOptions serverURL knownServers verboseExceptions JSON
#  LocalWords:  bluejaxOptions provideXHR onLine favicon ico ttttt
