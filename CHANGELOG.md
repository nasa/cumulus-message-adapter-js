# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Update tests to use downloaded message adapter[CUMULUS-864]

## [v1.0.4] - 2018-08-16
### Added

- Store task context metadata in `meta.workflow_tasks`, if it exists.

## [v1.0.3] - 2018-07-26

- Fixed location for pulling execution name.

## [v1.0.2] - 2018-07-23
### Fixed

- Evironment variables for task name, task version, and execution name.

## [v1.0.1] - 2018-03-08
### Added

- Add the `CUMULUS_MESSAGE_ADAPTER_DIR` environment variable to set the path where cumulus-message-adapter is located

## [v1.0.0] - 2018-03-07

Initial release

[Unreleased]: https://github.com/cumulus-nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.3...HEAD
[v1.0.3]: https://github.com/cumulus-nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.2...v1.0.3
[v1.0.2]: https://github.com/cumulus-nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.1...v1.0.2
[v1.0.1]: https://github.com/cumulus-nasa/cumulus-cumulus-message-adapter-js/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/cumulus-nasa/cumulus-message-adapter-js/tree/v1.0.0
