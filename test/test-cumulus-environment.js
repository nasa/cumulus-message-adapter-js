'use strict';

const test = require('ava');

const { setCumulusEnvironment } = require('../dist/cma');

const LOGGING_ENV_VARS = [
  'ASYNCOPERATIONID', 'EXECUTIONS', 'GRANULES', 'PARENTARN',
  'SENDER', 'STACKNAME', 'TASKVERSION',
];

const context = {
  functionName: 'cnsld-cumulus-prod-SyncGranule',
  functionVersion: '$LATEST',
  getRemainingTimeInMillis: () => 100000,
};

const messageWithParent = () => ({
  cumulus_meta: {
    execution_name: 'parented-execution',
    parentExecutionArn: 'arn:aws:states:us-west-2:1234:execution:stack-DiscoverGranules:abc',
    asyncOperationId: 'async-operation-1',
  },
  meta: { workflow_name: 'IngestGranule', stack: 'test-stack' },
  payload: { granules: [{ granuleId: 'granule-a' }] },
});

const messageWithoutParent = () => ({
  cumulus_meta: {
    execution_name: 'reingest-execution',
    cumulus_context: { reingestGranule: true, forceDuplicateOverwrite: true },
  },
  meta: { workflow_name: 'IngestGranuleCNM', stack: 'test-stack' },
  payload: { granules: [{ granuleId: 'granule-b' }] },
});

test.beforeEach(() => {
  LOGGING_ENV_VARS.forEach((n) => delete process.env[n]);
});
test.afterEach.always(() => {
  LOGGING_ENV_VARS.forEach((n) => delete process.env[n]);
});

test.serial('sets logging variables from the message', (t) => {
  setCumulusEnvironment(messageWithParent(), context);
  t.is(process.env.PARENTARN, 'arn:aws:states:us-west-2:1234:execution:stack-DiscoverGranules:abc');
  t.is(process.env.GRANULES, JSON.stringify(['granule-a']));
});

test.serial('PARENTARN does not leak across warm-container invocations', (t) => {
  setCumulusEnvironment(messageWithParent(), context);
  setCumulusEnvironment(messageWithoutParent(), context);
  t.is(process.env.PARENTARN, undefined);
  t.is(process.env.EXECUTIONS, 'reingest-execution');
});

test.serial('ASYNCOPERATIONID does not leak across warm-container invocations', (t) => {
  setCumulusEnvironment(messageWithParent(), context);
  setCumulusEnvironment(messageWithoutParent(), context);
  t.is(process.env.ASYNCOPERATIONID, undefined);
});

test.serial('a parented message after an unparented one still sets PARENTARN', (t) => {
  setCumulusEnvironment(messageWithoutParent(), context);
  setCumulusEnvironment(messageWithParent(), context);
  t.is(process.env.PARENTARN, 'arn:aws:states:us-west-2:1234:execution:stack-DiscoverGranules:abc');
});
