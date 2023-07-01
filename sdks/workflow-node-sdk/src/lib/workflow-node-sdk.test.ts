import { beforeEach, describe, expect, it, test, vi } from 'vitest';
import { createWorkflowClient } from './create-workflow-client';
import { MemoryStore } from './adapters/memory-store';
import { MemoryPersistencePlugin } from './plugins/memory-persistence-plugin';
import { ChildWorkflowMetadata } from '@ballerine/workflow-core';
import { WorkflowOptionsNode } from './types';

const simpleMachine = {
  id: 'toggle',
  initial: 'inactive',
  context: {},
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } },
  },
};

test('Simple Server Workflow', async () => {
  console.log('Running create Server Workflow');

  const workflow = createWorkflowClient();
  const runner = workflow.createWorkflow({
    definitionType: 'statechart-json',
    definition: simpleMachine,
  });

  expect(runner.getSnapshot().value).toBe('inactive');
  await runner.sendEvent({ type: 'TOGGLE' });
  expect(runner.getSnapshot().value).toBe('active');

  await runner.sendEvent({ type: 'TOGGLE' });
  expect(runner.getSnapshot().value).toBe('inactive');
});

test.skip('Server Workflow persistence MemoryStore', () => {
  const userId = '123456';
  const memoryStore = new MemoryStore();
  const memoryPersistencePlugin = new MemoryPersistencePlugin({
    name: 'in-memory-persistence',
    stateNames: [],
    when: 'post',
    store: memoryStore,
  });

  simpleMachine.context = { ...(simpleMachine.context || {}), entityId: userId };

  const workflow = createWorkflowClient().createWorkflow({
    definitionType: 'statechart-json',
    definition: simpleMachine,
    extensions: {
      statePlugins: [memoryPersistencePlugin],
    },
  });

  expect(workflow.getSnapshot().value).toBe('inactive');
  workflow.sendEvent({ type: 'TOGGLE' });
  expect(workflow.getSnapshot().value).toBe('active');

  const userWorkflows = memoryStore.find(userId);
  expect(userWorkflows.length).toBe(1);

  const workflowId = userWorkflows[0]!;
  let workflowData = memoryStore.get(workflowId, userId);

  expect(workflowData).toBeTruthy();

  console.log(workflowData);
  const restoredWorkflow = createWorkflowClient().createWorkflow({
    definitionType: 'statechart-json',
    definition: simpleMachine,
    workflowContext: { machineContext: workflowData!.context, state: workflowData!.state },
    extensions: {
      statePlugins: [memoryPersistencePlugin],
    },
  });

  restoredWorkflow.sendEvent({ type: 'TOGGLE' });
  expect(restoredWorkflow.getSnapshot().value).toBe('inactive');
});

const parentMachineBase = {
  definitionType: 'statechart-json' as const,
  definition: {
    id: 'parent_machine',
    initial: 'parent_initial',
    context: {},
    states: {
      parent_initial: { on: { NEXT: 'invoke_child' } },
      invoke_child: { on: { NEXT: 'invoked_child' } },
      invoked_child: {
        type: 'final',
      },
    },
  },
  workflowContext: {
    machineContext: {},
  },
} satisfies WorkflowOptionsNode;
const childMachine = {
  definitionType: 'statechart-json' as const,
  definition: {
    id: 'child_machine',
    initial: 'child_initial',
    context: {},
    states: {
      child_initial: { on: { NEXT: 'child_final' } },
      child_final: {
        type: 'final',
      },
    },
  },
} satisfies Omit<WorkflowOptionsNode, 'childWorkflows' | 'onInvokeChildWorkflow' | 'onEvent'>;

describe('Parent and child workflows #integration #featureset', () => {
  let response:
    | {
        childWorkflowMetadata: ChildWorkflowMetadata;
        childSnapshot: ReturnType<
          ReturnType<ReturnType<typeof createWorkflowClient>['createWorkflow']>['getSnapshot']
        >;
      }
    | undefined;
  const onInvokeChildWorkflow = vi.fn(async (childWorkflowMetadata: ChildWorkflowMetadata) => {
    {
      const childWorkflowService = workflowClient.createWorkflow({
        ...childMachine,
        definition: {
          ...childMachine.definition,
          context: childWorkflowMetadata?.initOptions?.context,
        },
        workflowContext: {
          machineContext: childWorkflowMetadata?.initOptions?.context,
        },
      });

      if (childWorkflowMetadata?.initOptions?.event) {
        await childWorkflowService.sendEvent({
          type: childWorkflowMetadata?.initOptions?.event,
        });
      }

      response = {
        childWorkflowMetadata,
        childSnapshot: childWorkflowService.getSnapshot(),
      };
    }
  });
  const onInvokeChildWorkflowTwo = vi.fn(async (childWorkflowMetadata: ChildWorkflowMetadata) => {
    {
      return;
    }
  });

  beforeEach(() => {
    onInvokeChildWorkflow.mockClear();
    onInvokeChildWorkflowTwo.mockClear();
    response = undefined;
  });

  let workflowClient = createWorkflowClient({
    onInvokeChildWorkflow,
  });
  let parentWorkflowService = workflowClient.createWorkflow({
    ...parentMachineBase,
    childWorkflows: [
      {
        name: 'child_machine_name_1',
        definitionId: 'child_machine_definition_1',
        runtimeId: 'child_machine_runtime_1',
        definitionVersion: 1,
        stateNames: ['invoke_child'],
        // Context to copy from the parent workflow
        contextToCopy: 'stakeholders',
        callbackInfo: {
          event: 'parent_initial',
          contextToCopy: 'endUser.id',
        },
        initOptions: {
          event: 'NEXT',
          context: {
            type: 'kyb_child',
          },
          state: 'child_initial',
        },
      },
    ],
  });

  describe('when a child workflow is invoked', async () => {
    it('should be invoked once for configured stateNames', async () => {
      await parentWorkflowService.sendEvent({
        type: 'NEXT',
      });

      expect(onInvokeChildWorkflow).toHaveBeenCalledTimes(1);
    });

    it("should return the child's workflow metadata", async () => {
      await parentWorkflowService.sendEvent({
        type: 'NEXT',
      });

      expect(response?.childWorkflowMetadata).toStrictEqual({
        name: 'child_machine_name_1',
        definitionId: 'child_machine_definition_1',
        runtimeId: 'child_machine_runtime_1',
        version: 1,
        initOptions: {
          event: 'NEXT',
          context: {
            type: 'kyb_child',
          },
          state: 'child_initial',
        },
      } satisfies ChildWorkflowMetadata);
    });

    it('should only be invoked for configured stateNames', async () => {
      await parentWorkflowService.sendEvent({
        type: 'NEXT',
      });
      await parentWorkflowService.sendEvent({
        type: 'NEXT',
      });

      expect(onInvokeChildWorkflow).toHaveBeenCalledTimes(1);
      expect(parentWorkflowService.getSnapshot().value).toBe('invoked_child');
    });

    workflowClient = createWorkflowClient({
      onInvokeChildWorkflow: onInvokeChildWorkflowTwo,
    });
    parentWorkflowService = workflowClient.createWorkflow({
      ...parentMachineBase,
      childWorkflows: [
        {
          name: 'child_machine_name_2',
          definitionId: 'child_machine_definition_2',
          runtimeId: 'child_machine_runtime_2',
          definitionVersion: 1,
          stateNames: ['invoke_child', 'invoked_child'],
          // Context to copy from the parent workflow
          contextToCopy: 'stakeholders',
          callbackInfo: {
            event: 'parent_initial',
            contextToCopy: 'endUser.id',
          },
          initOptions: {
            event: 'NEXT',
            context: {
              type: 'kyb_child',
            },
            state: 'child_initial',
          },
        },
      ],
    });

    it('should be invoked on two or more configured stateNames', async () => {
      await parentWorkflowService.sendEvent({
        type: 'NEXT',
      });
      await parentWorkflowService.sendEvent({
        type: 'NEXT',
      });

      expect(onInvokeChildWorkflowTwo).toHaveBeenCalledTimes(2);
      expect(parentWorkflowService.getSnapshot().value).toBe('invoked_child');
    });
  });
});
