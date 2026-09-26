const proxyquire = require('proxyquire');
const { runCumulusTask } = proxyquire('../../dist/cma', {
  lookpath: { lookpath: async() => process.execPath },
});
let taskInput;
runCumulusTask((event) => {
  taskInput = event.input; return event.input;
}, {
  meta: { workflow_name: 'test' }, payload: { ordinary: true }, cumulus_meta: {},
}, {}).then((output) => {
  console.log(`RESULT=${JSON.stringify({ taskInput, payload: output.payload })}`);
}, (error) => {
  console.error(error);
  process.exitCode = 1;
});
