import type { MochaOptions } from 'mocha';

import chalk from 'chalk';
import path from 'path';

import { getAllFilesMatching } from 'hardhat/internal/util/fs-utils';

subtask('get-test-files')
  .addOptionalVariadicPositionalParam('testFiles', 'An optional list of files to test', [])
  .setAction(async ({ testFiles }: { testFiles: string[] }, { config }) => {
    if (testFiles.length !== 0) {
      const testFilesAbsolutePaths = testFiles.map(x => path.resolve(process.cwd(), x));

      return testFilesAbsolutePaths;
    }

    const jsFiles = await getAllFilesMatching(config.paths.tests, f => f.endsWith('.js'));

    const mjsFiles = await getAllFilesMatching(config.paths.tests, f => f.endsWith('.mjs'));

    return [...jsFiles, ...mjsFiles];
  });

subtask('run-mocha-test')
  .addFlag('parallel', 'Run tests in parallel')
  .addFlag('bail', 'Stop running tests after the first test failure')
  .addOptionalParam('grep', 'Only run tests matching the given string or regexp')
  .addOptionalVariadicPositionalParam('testFiles', 'An optional list of files to test', [])
  .setAction(
    async (
      taskArgs: {
        bail: boolean;
        parallel: boolean;
        testFiles: string[];
        grep?: string;
      },
      { config },
    ) => {
      const { default: Mocha } = await import('mocha');

      const mochaConfig: MochaOptions = { ...config.mocha };

      if (taskArgs.grep !== undefined) {
        mochaConfig.grep = taskArgs.grep;
      }
      if (taskArgs.bail) {
        mochaConfig.bail = true;
      }
      if (taskArgs.parallel) {
        mochaConfig.parallel = true;
      }

      // no timeout
      mochaConfig.timeout = 0;

      if (mochaConfig.parallel === true) {
        const mochaRequire = mochaConfig.require ?? [];
        if (!mochaRequire.includes('hardhat/register')) {
          mochaRequire.push('hardhat/register');
        }
        mochaConfig.require = mochaRequire;
      }

      const mocha = new Mocha(mochaConfig);
      taskArgs.testFiles.forEach(file => mocha.addFile(file));
      // This instructs Mocha to use the more verbose file loading infrastructure
      // which supports both ESM and CJS
      await mocha.loadFilesAsync();

      const testFailures = await new Promise<number>(resolve => {
        mocha.run(resolve);
      });

      mocha.dispose();

      return testFailures;
    },
  );

task('test-esm', 'Runs mocha tests including ESM modules')
  .addOptionalVariadicPositionalParam('testFiles', 'An optional list of files to test', [])
  .addFlag('noCompile', "Don't compile before running this task")
  .addFlag('parallel', 'Run tests in parallel')
  .addFlag('bail', 'Stop running tests after the first test failure')
  .addOptionalParam('grep', 'Only run tests matching the given string or regexp')
  .setAction(
    async (
      {
        testFiles,
        noCompile,
        parallel,
        bail,
        grep,
      }: {
        testFiles: string[];
        noCompile: boolean;
        parallel: boolean;
        bail: boolean;
        grep?: string;
      },
      { run, network },
    ) => {
      if (!noCompile) {
        await run('compile', { quiet: true });
      }

      const files = await run('get-test-files', { testFiles });

      process.env.LOG_LEVEL = 'error';

      const testFailures = await run('run-mocha-test', {
        testFiles: files,
        parallel,
        bail,
        grep,
      });

      if (network.name === 'hardhat') {
        const stackTracesFailures = await network.provider.send(
          'hardhat_getStackTraceFailuresCount',
        );

        if (stackTracesFailures !== 0) {
          console.warn(
            chalk.yellow(
              `Failed to generate ${stackTracesFailures} ${pluralize(
                stackTracesFailures,
                'stack trace',
              )}. Run Hardhat with --verbose to learn more.`,
            ),
          );
        }
      }

      process.exitCode = testFailures;
      return testFailures;
    },
  );
