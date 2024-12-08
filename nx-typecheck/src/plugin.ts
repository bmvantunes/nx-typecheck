import type {
  CreateNodesV2,
  CreateNodesResultV2,
  ProjectConfiguration,
  TargetConfiguration,
  CreateNodesContext,
  CreateNodesResult,
} from '@nx/devkit';

import { createNodesFromFiles } from '@nx/devkit';

import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface TypecheckPluginOptions {
  typecheckTargetName: string;
}

export const createNodesV2: CreateNodesV2<TypecheckPluginOptions> = [
  '**/tsconfig.json',
  async (configFilePaths, options, context): Promise<CreateNodesResultV2> => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(
          configFile,
          normalizeOptions(options),
          context,
          isUsingTsSolutionSetup()
        ),
      configFilePaths,
      normalizeOptions(options),
      context
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: TypecheckPluginOptions,
  context: CreateNodesContext,
  isUsingTsSolutionSetup: boolean
): Promise<CreateNodesResult> {
  const projectRoot = dirname(configFilePath);
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));

  // Only create typecheck target if it's a valid project
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  const normalizedOptions = normalizeOptions(options);

  const project: ProjectConfiguration = {
    root: projectRoot,
    targets: {
      [normalizedOptions.typecheckTargetName]: createTypecheckTarget(
        siblingFiles,
        isUsingTsSolutionSetup,
        projectRoot
      ),
    },
  };

  return {
    projects: {
      [projectRoot]: project,
    },
  };
}

function createTypecheckTarget(
  siblingFiles: string[],
  isUsingTsSolutionSetup: boolean,
  projectRoot: string
): TargetConfiguration {
  const target: TargetConfiguration = {
    cache: true,
    inputs: ['default', '^default', { externalDependencies: ['typescript'] }],
    executor: 'nx:run-commands',
    options: {
      commands: siblingFiles
        .filter(
          (file) =>
            file !== 'tsconfig.json' &&
            file.startsWith('tsconfig') &&
            file.endsWith('.json')
        )
        .map((file) => {
          return `tsc --noEmit -p ${file}`;
        }),
      parallel: true,
      cwd: projectRoot,
    },
    parallelism: true,
    metadata: {
      description: `Run Typechecking`,
      technologies: ['typescript'],
    },
  };

  if (isUsingTsSolutionSetup) {
    target.syncGenerators = ['@nx/js:typescript-sync'];
  }

  return target;
}

function normalizeOptions(
  options?: Partial<TypecheckPluginOptions>
): TypecheckPluginOptions {
  return { typecheckTargetName: options?.typecheckTargetName ?? 'typecheck' };
}
