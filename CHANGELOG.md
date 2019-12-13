# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
https://github.com/nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.10...HEAD
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
