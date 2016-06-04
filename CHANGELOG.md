
* 0.2.0:

  + Split into ``bluejax`` and ``bluejax.try``.

  + Added the ``shouldRetry`` option.

  + Added the ``ajax$(...)`` call.

  + Added the ``field`` option to ``make(...)``.

  - Removed ``setDefaultOptions`` and ``getDefaultOptions``. They encourage the
    bad habit of modifying a module to set options globally. There are other
    ways to do it.
