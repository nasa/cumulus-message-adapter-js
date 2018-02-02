# @cumulus/cumulus-message-adapter-js

[![CircleCI](https://circleci.com/gh/cumulus-nasa/cumulus-message-adapter-js.svg?style=svg)](https://circleci.com/gh/cumulus-nasa/cumulus-message-adapter-js)

## What is Cumulus?

Cumulus is a cloud-based data ingest, archive, distribution and management
prototype for NASA's future Earth science data streams.

Read the [Cumulus Documentation](https://cumulus-nasa.github.io/)

## What is the Cumulus Message Adapter?

The Cumulus Message Adapter is a library that adapts incoming messages in the
Cumulus protocol to a format more easily consumable by Cumulus tasks, invokes
the tasks, and then adapts their response back to the Cumulus message protocol
to be sent to the next task.

## Installation

The cumulus-message-adapter-js can be installed via Node Package Manager (NPM) and the package is located [here](https://www.npmjs.com/package/@cumulus/cumulus-message-adapter-js).

Add @cumulus/cumulus-message-adapter-js to your package.json and run ```npm install```.

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
`runCumulusTask`. It takes four parameters:

  * `taskFunction` - the function containing your business logic (as described
    above)
  * `cumulusMessage` - the event passed by Lambda, and should be a Cumulus
    Message
  * `context` - the Lambda context
  * `callback` - the callback passed by Lambda

## Example Cumulus task

```javascript
const cumulusMessageAdapter = require('@cumulus/cumulus-message-adapter-js');

function myBusinessLogic(nestedEvent, context) {
  console.log('Hello, example!');
  return { answer: 42 };
}

// The handler function should rarely, if ever, contain more than this line
function handler(event, context, callback) {
  cumulusMessageAdapter.runCumulusTask(myBusinessLogic, event, callback);
}
exports.handler = handler;
```

## Creating a deployment package

Tasks that use this library are just standard AWS Lambda tasks. Information on
creating release packages is available [here](https://docs.aws.amazon.com/lambda/latest/dg/deployment-package-v2.html).

## Usage in Cumulus Deployments

During deployment, Cumulus will automatically obtain and inject the [Cumulus Message Adapter](https://github.com/cumulus-nasa/cumulus-message-adapter) zip into the compiled code and create a zip file to be deployed to Lambda.

A task using the message adapter would be configured in lambdas.yml as follows:

```yaml
NodeTest:
  handler: index.handler
  timeout: 300
  memory: 256
  source: 'node_modules/@cumulus/task-task/dist/'
  useMessageAdapter: true
```

## Development

### Running Tests

To run the tests for this package, run ```npm run test```

## Why?

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
