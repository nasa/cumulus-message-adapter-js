import * as cma from './cma';

module.exports = {
  generateCMASpawnArguments: cma.generateCMASpawnArguments,
  invokeCumulusMessageAdapter: cma.invokeCumulusMessageAdapter,
  runCumulusTask: cma.runCumulusTask
};
