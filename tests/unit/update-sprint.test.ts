/**
 * Tests for the update_sprint handler covering name backfill behaviour
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { UpdateSprintArgs } from '../../src/tools/update-sprint.js';

interface MockSprintResponse {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: string;
  originBoardId?: number;
  id?: number;
}

const mockPut = jest.fn<Promise<{ data: MockSprintResponse }>, [string, MockSprintResponse]>();
const mockGet = jest.fn<Promise<{ data: MockSprintResponse }>, [string]>();

await jest.unstable_mockModule('../../src/utils/tool-wrapper.js', () => ({
  withJiraContext: (
    args: Record<string, unknown>,
    _options: unknown,
    handler: (
      toolArgs: Record<string, unknown>,
      context: { agileAxiosInstance: { put: typeof mockPut; get: typeof mockGet } }
    ) => Promise<unknown>
  ) => {
    const toolArgs: Record<string, unknown> = { ...args };
    delete toolArgs.working_dir;
    delete toolArgs.instance;
    return handler(toolArgs, {
      agileAxiosInstance: {
        put: mockPut,
        get: mockGet,
      },
    });
  },
}));

const { handleUpdateSprint } = await import('../../src/tools/update-sprint.js');

describe('handleUpdateSprint', () => {
  beforeEach(() => {
    mockPut.mockReset();
    mockGet.mockReset();
  });

  test('backfills existing sprint name when not provided by caller', async () => {
    mockGet.mockResolvedValue({ data: { name: 'Existing Sprint', goal: 'Existing Goal' } });
    mockPut.mockResolvedValue({
      data: {
        id: 1391,
        name: 'Existing Sprint',
        state: 'active',
        originBoardId: 135,
        startDate: '2025-10-02T00:00:00.000Z',
        endDate: '2025-10-16T00:00:00.000Z',
      },
    });

    const args: UpdateSprintArgs = {
      working_dir: '/tmp/project',
      instance: 'onvex',
      sprintId: 1391,
      startDate: '2025-10-02',
      endDate: '2025-10-16',
    };

    await handleUpdateSprint(args);

    expect(mockGet).toHaveBeenCalledWith('/sprint/1391');
    expect(mockPut).toHaveBeenCalledWith(
      '/sprint/1391',
      expect.objectContaining({
        name: 'Existing Sprint',
        goal: 'Existing Goal',
        startDate: '2025-10-02T00:00:00.000Z',
        endDate: '2025-10-16T00:00:00.000Z',
      })
    );
  });

  test('throws when sprint name is unavailable from Jira and caller omits name', async () => {
    mockGet.mockResolvedValue({ data: { goal: 'Existing Goal' } });

    const args: UpdateSprintArgs = {
      working_dir: '/tmp/project',
      instance: 'onvex',
      sprintId: 1391,
      startDate: '2025-10-02',
      endDate: '2025-10-16',
    };

    await expect(handleUpdateSprint(args)).rejects.toThrow(
      "Sprint 1391 is missing a name in Jira; provide 'name' when updating."
    );

    expect(mockPut).not.toHaveBeenCalled();
  });
});
