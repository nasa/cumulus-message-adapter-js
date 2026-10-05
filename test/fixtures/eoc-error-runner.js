const childProcess = require('child_process');
const proxyquire = require('proxyquire');
let closed;
const { runCumulusTask } = proxyquire('../../dist/cma', {
  lookpath: { lookpath: async() => process.execPath },
  child_process: {
    spawn: (...args) => {
      const child = childProcess.spawn(...args);
      closed = new Promise((resolve) => child.once('close', resolve));
      return child;
    },
  },
});
runCumulusTask(async() => {
  if (process.env.CMA_TEST_EXIT) await closed;
  return { ordinary: true };
}, { meta: { workflow_name: 'test' }, payload: { ordinary: true }, cumulus_meta: {} }, {})
  .then(() => {
    console.error('Unexpected task success'); process.exitCode = 1;
  }, (error) => {
    console.log(`RESULT=${JSON.stringify({ name: error.name, message: error.message })}`);
  });
