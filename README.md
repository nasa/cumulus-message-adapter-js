# @cumulus/cumulus-message-adapter-js

[![CircleCI](https://circleci.com/gh/nasa/cumulus-message-adapter-js.svg?style=svg)](https://circleci.com/gh/nasa/cumulus-message-adapter-js)
[![npm version](https://badge.fury.io/js/%40cumulus%2Fcumulus-message-adapter-js.svg)](https://badge.fury.io/js/%40cumulus%2Fcumulus-message-adapter-js)

## What is Cumulus

Cumulus is a cloud-based data ingest, archive, distribution and management
prototype for NASA's future Earth science data streams.

Read the [Cumulus Documentation](https://nasa.github.io/cumulus)

## What is the Cumulus Message Adapter?

The Cumulus Message Adapter is a library that adapts incoming messages in the
Cumulus protocol to a format more easily consumable by Cumulus tasks, invokes
the tasks, and then adapts their response back to the Cumulus message protocol
to be sent to the next task.

## Installation

The cumulus-message-adapter-js can be installed via Node Package Manager (NPM) and the package is located [here](https://www.npmjs.com/package/@cumulus/cumulus-message-adapter-js).

The package can be added to your project by running `npm install @cumulus/cumulus-message-adapter-js --save`.

## Task definition

In order to use the Cumulus Message Adapter, you will need to create two
methods in your task module: a handler function and a business logic function.

The handler function is a standard Lambda handler function which takes three
parameters (as specified by AWS): `event`, `context`, and `callback`.

The business logic function is where the actual work of your task occurs. It
should take two parameters: `nestedEvent` and `context`.

The `nestedEvent` object contains two keys:

* `input` - the task's input, typically the `payload` of the message,
    produced at runtime
* `config` - the task's configuration, with any templated variables
    resolved

The `context` parameter is the standard Lambda context as passed by AWS.

The return value of the business logic function will be placed in the
`payload` of the resulting Cumulus message.

Expectations for input, config, and return values are all defined by the task,
and should be well documented. Tasks should thoughtfully consider their inputs
and return values, as breaking changes may have cascading effects on tasks
throughout a workflow. Configuration changes are slightly less impactful, but
must be communicated to those using the task.

## Cumulus Message Adapter interface

The Cumulus Message adapter for Javascript provides one method:
`runCumulusTask`. It takes five parameters:

* `taskFunction` - the function containing your business logic (as described
    above)
* `cumulusMessage` - the event passed by Lambda, and should be a Cumulus
    Message
* `context` - the Lambda context
* `callback` - the callback passed by Lambda
* `schemas` - JSON object with the locations of the task schemas

The `schemas` JSON should contain `input:`, `output:`, and `config:` with strings for each location. If the schema locations are not specified, the message adapter will look for schemas in a schemas directory at the root level for the files: input.json, output.json, or config.json. If the schema is not specified or missing, schema validation will not be performed.

## Example Cumulus task

```javascript
const cumulusMessageAdapter = require('@cumulus/cumulus-message-adapter-js');

function myBusinessLogic(nestedEvent, context) {
  console.log('Hello, example!');
  return { answer: 42 };
}

// The handler function should rarely, if ever, contain more than this line
function handler(event, context, callback) {
  cumulusMessageAdapter.runCumulusTask(myBusinessLogic, event, context, callback, schemas);
}
exports.handler = handler;
```

## Creating a deployment package

Tasks that use this library are just standard AWS Lambda tasks. Information on
creating release packages is available [here](https://docs.aws.amazon.com/lambda/latest/dg/deployment-package-v2.html).

## Usage in Cumulus Deployments

For documentation on how to utilize this package in a Cumulus Deployment, view the [Cumulus Workflow Documenation](https://nasa.github.io/cumulus/docs/workflows/input_output).

## Environment variables

There are two environment variables that can be used with this library:

* `CUMULUS_MESSAGE_ADAPTER_DISABLED=true`
  * Defaults to false. This env var disables Cumulus Message Adapter. This can be used to turn off the message adapter for tasks that adapt the message on their own, or for testing.
* `CUMULUS_MESSAGE_ADAPTER_DIR`
  * The default directory for Cumulus Message Adapter is the root directory of the lambda function.

## Development

### Running Tests

To run the tests for this package, run `npm run lint && npm test`

## Why use this approach

This approach has a few major advantages:

1. It explicitly prevents tasks from making assumptions about data structures
   like `meta` and `cumulus_meta` that are owned internally and may therefore
   be broken in future updates. To gain access to fields in these structures,
   tasks must be passed the data explicitly in the workflow configuration.
1. It provides clearer ownership of the various data structures. Operators own
   `meta`. Cumulus owns `cumulus_meta`. Tasks define their own `config`,
   `input`, and `output` formats.
1. The Cumulus Message Adapter greatly simplifies running Lambda functions not
   explicitly created for Cumulus.
1. The approach greatly simplifies testing for tasks, as tasks don't need to
   set up cumbersome structures to emulate the message protocol and can just
   test their business function.
