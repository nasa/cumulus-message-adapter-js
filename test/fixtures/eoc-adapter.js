/* A local stream-protocol peer; it performs no AWS requests. */
const readline = require('readline');
const lines = readline.createInterface({ input: process.stdin });
let command;
let input = [];
lines.on('line', (line) => {
  if (line === '<EXIT>') {
    process.exit(0);
  }
  if (!command) {
    command = line; return;
  }
  if (line !== '<EOC>') {
    input.push(line); return;
  }
  const args = JSON.parse(input.join('\n'));
  const data = JSON.parse(process.env.CMA_TEST_DATA);
  const stage = process.env.CMA_TEST_STAGE;
  let output;
  if (command === 'loadAndUpdateRemoteEvent') {
    output = { ...args.event, payload: stage === 'load' ? data : args.event.payload };
  }
  else if (command === 'loadNestedEvent') {
    output = { input: stage === 'nested' ? data : args.event.payload, config: {} };
  }
  else {
    output = { ...args.event, payload: stage === 'next' ? data : args.handler_response };
  }
  let text = JSON.stringify(output, null, process.env.CMA_TEST_PRETTY === '1' ? 2 : 0);
  if (process.env.CMA_TEST_INVALID === command) text = '{invalid';
  process.stdout.write(`${text}<EOC>\n`);
  if (process.env.CMA_TEST_EXIT === command) {
    process.stderr.write('synthetic adapter failure\n');
    process.exit(23);
  }
  command = undefined;
  input = [];
});
