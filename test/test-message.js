'use strict';

const test = require('ava');
const fs = require('fs-extra');
const path = require('path');

const {
  getMessageGranules,
  getStackName,
  getParentArn,
  getAsyncOperationId,
} = require('../dist/message');

const testContext = {};

test.before(async() => {
  const inputJson = path.join(__dirname, 'fixtures/messages/basic.input.json');
  testContext.inputEvent = JSON.parse(fs.readFileSync(inputJson));
  const granuleInputJson = path.join(__dirname, 'fixtures/messages/execution.granule.input.json');
  testContext.granuleInputJson = JSON.parse(fs.readFileSync(granuleInputJson));
  const inputGranuleInputJson = path.join(__dirname,
    'fixtures/messages/execution.granule.input.json');
  testContext.inputGranuleInputJson = JSON.parse(fs.readFileSync(inputGranuleInputJson));
});

test.serial('GetMessageGranules returns empty array if no granules are found', (t) => {
  const messageGranules = getMessageGranules(testContext.inputEvent);
  t.deepEqual(messageGranules, []);
});

test.serial('GetMessageGranules returns granules if they are in the payload', (t) => {
  const messageGranules = getMessageGranules(testContext.granuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017',
  ]);
});

test.serial('GetMessageGranules returns granules if they are in the meta.input_granules', (t) => {
  const messageGranules = getMessageGranules(testContext.inputGranuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017',
  ]);
});

test.serial('GetMessageGranules truncates granules over the specified limit', (t) => {
  const inputGranules = Array(5).fill().map((e, i) => ({ granuleId: `granule-${i}` }));
  const message = { payload: { granules: inputGranules } };
  const messageGranules = getMessageGranules(message, 3);
  t.deepEqual(messageGranules, [
    'granule-0',
    'granule-1',
    'granule-2',
  ]);
});

test.serial('GetStackName returns a stack name if the stack is in the meta', (t) => {
  const stack = getStackName(testContext.inputEvent);
  t.is(stack, 'cumulus-stack');
});

test.serial('GetParentArn returns a parent arn if the parentArn is in the cumulus_meta', (t) => {
  const arn = getParentArn(testContext.inputEvent);
  t.is(arn,
    'arn:aws:states:us-east-1:12345:execution:DiscoverGranules:8768aebb');
});

// eslint-disable-next-line max-len
test.serial('GetAsyncOperationId returns an async operation id if the asyncOperationId is in the cumulus_meta', (t) => {
  const asyncOperationId = getAsyncOperationId(testContext.inputEvent);

  t.is(asyncOperationId, 'async-id-123');
});
