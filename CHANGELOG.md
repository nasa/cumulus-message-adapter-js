# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic
Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

- **CUMULUS-2920**
  - Update dev dependencies to allow inter-version compatibility
  - Update package-lock.json to use new dependencies/newer npm format
  - Update circleCi build to use npm@8.6.0

## [v2.0.4] 2021-12-09

### Fixed

- **CUMULUS-2745**
  - Fixed erroneous log output when running as a lambda incorrectly indicating timeout behaviors were not enabled
  - Update error handling logic to wait for completion of CMA close event before throwing
  - Fix streaming interface issue where an empty line is being sent to the CMA
  where it was being interpreted as empty string for the command

## [v2.0.3] 2021-11-20

### Fixed

- **CUMULUS-2745**
  - Bug fix/patch release to fix issue where Lambda execution contexts like ECS tasks that did not have an AWS Lambda `context` object with a `getRemainingTimeInMillis` method resulted in task failure

## [v2.0.2] 2021-11-17

### Updated

- **CUMULUS-2745**
  - Updates logging to always log CMA stderr on function timeout

## [v2.0.1] 2021-09-28

- Update `@cumulus/types` package dependency to `^9.6.0`

## [v2.0.0] 2020-10-19

### BREAKING CHANGES

- **CUMULUS-2203**
  - Updated CumulusMessageWithPayload exported to
    CumulusMessageWithAssignedPayload.  This change explicitly updates this type
    to allow for a `null` payload value, as well as explicitly allows for a
    `replace` key for compatibility with `@cumulus/types` > 3.0.0

## [v1.3.2] 2020-10-13

### Fixed

- **CUMULUS_2203**

- Fixed issue causing spawned CMA process to left running/in the node event
  queue, resulting in AWS being unwilling/unable to clean up the instance. This resulted in lambdas with a memory leak/resource issues to not be
  reclaimed/restarted by AWS.

- Fixed issue where the CMA child process was not cleaning up/deallocating
  buffered data when the parent process ends, creating a memory 'leak'. This
  commit updates the error handling to issue SIGTERM/SIGINT in case of error,
  allowing the subprocess to exit properly.

## [v1.3.1] 2020-07-31

### Fixed

- Fixed issue with broken v1.3.0 release.  All users at 1.3.0 should update to 1.3.1

## [v1.3.0] 2020-07-30

### BREAKING CHANGES

- **CUMULUS-2065**

  - Removed CUMULUS_MESSAGE_ADAPTER_DISABLED environmental flag, and associated behaviors from `runCumulusTask`

### Changed

- **CUMULUS-2065**

  - Migrated package to TypeScript, moved all source to /src/*.ts

## [v1.2.0] 2020-05-04

### BREAKING CHANGES

- **CUMULUS-1896**

  - Updated `cumulus-message-adapter-js` to be asynchronous - handler functions should be updated to use 'async' style handlers.  See [AWS node.js handler documentation](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html) for details.    Lambdas utilizing this module will require an update to their handler.
  - Updated [Cumulus Message Adapter (CMA)](https://github.com/nasa/cumulus-message-adapter) subprocess calls to utilize streaming interface from CMA >= 1.3.0.   Use of this and future versions will require an update to CMA >= 1.3.0

## [v1.1.1] - 2020-01-15

### Fixed

- **CUMULUS-1708** - Fixed issue with CMA stderr/stdout being suppressed

## [v1.1.0] - 2019-12-12

### Changed

- **CUMULUS-1627** - Add shell out call to utilize pre-packaged AWS LINUX 2 binary for CMA when system python is unavailable.    This is a breaking change if your task environment does not have python in the system path, but *generally* should be backward compatible with most use cases.   Use of the precompiled binary requires use of CMA > 1.1.2, and is specifically targeted at AWS Linux 2 node 10/12 lambda environments.

## [v1.0.10] - 2019-11-14

### Changed

- **CUMULUS-1619** - Added async operation id to the environment variables for logging purposes

## [v1.0.9] - 2019-11-11

### Changed

- **CUMULUS-1619** - Granule IDs, stack name, parent execution ARN, and executions are extracted from the Cumulus message and stored in environment variables. These environment variables are used for logging initialization by the tasks. The granule IDs will be limited to the first 500 granules to avoid environment variable truncation.

## [v1.0.8] - 2019-09-16
### Added
- Updated CMA client to handle parameterized configuration, set execution env variable regardless of message format

## [v1.0.7] - 2018-11-08

### Removed
- Remove environment variable `REINGEST_GRANULE` which was used to indicate if the granule is manually reingested [CUMULUS-906]

## [v1.0.6] - 2018-11-07

### Added
- Add environment variable `REINGEST_GRANULE` to indicate if the granule is manually reingested [CUMULUS-906]

## [v1.0.5] - 2018-10-10

### Added
- Update tests to use downloaded message adapter [CUMULUS-864]

### Fixed
- Fix npm package vulnerabilities

## [v1.0.4] - 2018-08-16
### Added

- Store task context metadata in `meta.workflow_tasks`, if it exists.

## [v1.0.3] - 2018-07-26

- Fixed location for pulling execution name.

## [v1.0.2] - 2018-07-23
### Fixed

- Environment variables for task name, task version, and execution name.

## [v1.0.1] - 2018-03-08
### Added

- Add the `CUMULUS_MESSAGE_ADAPTER_DIR` environment variable to set the path where cumulus-message-adapter is located

## [v1.0.0] - 2018-03-07

Initial release


[Unreleased]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.3.0...HEAD
[v1.3.0]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.2.0...1.3.0
[v1.2.0]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.1.1...1.2.0
[v1.1.1]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.1.0...1.1.1
[v1.1.0]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.10...1.1.0
[v1.0.10]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.9...1.0.10
[v1.0.9]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.8...1.0.9
[v1.0.8]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.7...1.0.8
[v1.0.7]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.6...v1.0.7
[v1.0.6]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.5...v1.0.6
[v1.0.5]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.4...v1.0.5
[v1.0.4]:
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.3...v1.0.4
[v1.0.3]: https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.2...v1.0.3
[v1.0.2]: https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.1...v1.0.2
[v1.0.1]: https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/nasa/cumulus-message-adapter-js/tree/v1.0.0
