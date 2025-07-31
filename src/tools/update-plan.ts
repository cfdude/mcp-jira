/**
 * Update an existing strategic plan using JSON Patch operations (Jira Premium feature)
 */
import { withJiraContext } from '../utils/tool-wrapper.js';

interface UpdatePlanArgs {
  working_dir: string;
  instance?: string;
  planId: string;
  operations: Array<{
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
  }>;
  useGroupId?: boolean;
}

export async function handleUpdatePlan(args: UpdatePlanArgs) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      const params: any = {};
      if (toolArgs.useGroupId) {
        params.useGroupId = toolArgs.useGroupId;
      }

      const response = await axiosInstance.patch(
        `/plans/plan/${toolArgs.planId}`,
        toolArgs.operations,
        {
          params,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Format the operations for display
      const formatOperations = (operations: any[]) => {
        return operations
          .map((op, index) => {
            let description = `${index + 1}. **${op.op.toUpperCase()}**`;

            switch (op.op) {
              case 'replace':
                description += ` \`${op.path}\` with new value`;
                break;
              case 'add':
                description += ` new value to \`${op.path}\``;
                break;
              case 'remove':
                description += ` \`${op.path}\``;
                break;
              case 'move':
                description += ` from \`${op.from}\` to \`${op.path}\``;
                break;
              case 'copy':
                description += ` from \`${op.from}\` to \`${op.path}\``;
                break;
              case 'test':
                description += ` that \`${op.path}\` has expected value`;
                break;
              default:
                description += ` operation on \`${op.path}\``;
            }

            if (op.value !== undefined && op.op !== 'remove' && op.op !== 'move') {
              const valueStr =
                typeof op.value === 'object'
                  ? JSON.stringify(op.value).substring(0, 100) +
                    (JSON.stringify(op.value).length > 100 ? '...' : '')
                  : String(op.value);
              description += `\n   - Value: \`${valueStr}\``;
            }

            return description;
          })
          .join('\n\n');
      };

      const updatedPlan = response.data;

      return {
        content: [
          {
            type: 'text',
            text: `# Plan Updated Successfully

## 📋 Updated Plan Details
- **Plan ID**: ${toolArgs.planId}
- **Plan Name**: ${updatedPlan.name || 'Name not returned'}
- **Last Updated**: ${new Date().toLocaleString()}

## 🔧 Operations Applied (${toolArgs.operations.length})
${formatOperations(toolArgs.operations)}

## ✅ Update Summary
The plan has been successfully updated with all ${toolArgs.operations.length} operation(s). The changes are now active and will be reflected in:

- Jira's Advanced Roadmaps interface
- Plan views and dashboards
- Related team and project planning tools

## 📊 Common Update Paths
Here are some frequently used JSON Patch paths for plan updates:

### Basic Information
- \`/name\` - Update plan name
- \`/description\` - Update plan description
- \`/leadAccountId\` - Change plan lead
- \`/status\` - Update plan status

### Issue Sources
- \`/issueSources\` - Replace all issue sources
- \`/issueSources/-\` - Add new issue source to end
- \`/issueSources/0\` - Replace first issue source

### Scheduling
- \`/scheduling/estimation\` - Change estimation method
- \`/scheduling/dependencies\` - Update dependency handling
- \`/scheduling/startDate\` - Modify start date configuration
- \`/scheduling/endDate\` - Modify end date configuration

### Exclusion Rules
- \`/exclusionRules/numberOfDaysToShowCompletedIssues\` - Days to show completed
- \`/exclusionRules/issueIds\` - Excluded issue IDs
- \`/exclusionRules/workStatusIds\` - Excluded work status IDs

### Cross-Project Releases
- \`/crossProjectReleases\` - Replace all cross-project releases
- \`/crossProjectReleases/-\` - Add new cross-project release

### Custom Fields
- \`/customFields\` - Replace all custom field configurations
- \`/customFields/-\` - Add new custom field configuration

### Permissions
- \`/permissions\` - Replace all permissions
- \`/permissions/-\` - Add new permission

## 💡 Next Steps
- Use \`get-plan\` with ID ${toolArgs.planId} to view the updated plan details
- Use \`get-plan-teams\` to verify team assignments if you modified teams
- Check the plan in Jira's Advanced Roadmaps interface to see visual changes
- Consider notifying team members about significant plan changes

## 📖 JSON Patch Operations Reference
- **replace**: Replaces a value at the specified path
- **add**: Adds a new value at the specified path (or to end of array with \`/-\`)
- **remove**: Removes the value at the specified path
- **move**: Moves a value from one path to another
- **copy**: Copies a value from one path to another
- **test**: Tests that a path has a specific value (useful for conditional updates)

## ⚠️ Note
Plans are a Jira Premium feature requiring Advanced Roadmaps. Some operations may require specific permissions or feature availability.`,
          },
        ],
      };
    } catch (error: any) {
      // Check for specific error types
      if (error.response?.status === 404) {
        return {
          content: [
            {
              type: 'text',
              text: `# Plan Not Found

The plan with ID \`${toolArgs.planId}\` could not be found for updating. This could be due to:

- **Invalid Plan ID**: The plan ID may not exist or may have been deleted
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled
- **Instance Type**: Plans may not be available in your Jira instance type

## Troubleshooting Steps
1. **Verify Plan ID**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Plan Existence**: Use \`get-plan\` to verify the plan exists before updating
3. **Contact Administrator**: If you believe this plan should exist, contact your Jira administrator

## Alternative Actions
- Use \`list-plans\` to see all available plans
- Use \`create-plan\` to create a new strategic plan if needed`,
            },
          ],
        };
      }

      if (error.response?.status === 403) {
        return {
          content: [
            {
              type: 'text',
              text: `# Access Denied

You don't have permission to update plan \`${toolArgs.planId}\`. This could be due to:

- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Permissions**: You may not have the "Administer Jira" global permission
- **Plan Permissions**: The plan may have specific edit permissions that exclude you

Contact your Jira administrator if you need access to update plans.`,
            },
          ],
        };
      }

      if (error.response?.status === 400) {
        return {
          content: [
            {
              type: 'text',
              text: `# Invalid Update Operations

The update operations could not be applied to plan \`${toolArgs.planId}\`. This could be due to:

- **Invalid JSON Patch Format**: Check that your operations follow JSON Patch RFC 6902 specification
- **Invalid Paths**: Ensure all paths reference valid plan properties
- **Invalid Values**: Check that values match expected types and constraints
- **Conflicting Operations**: Some operations may conflict with each other

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## JSON Patch Operation Format
Each operation should follow this structure:
\`\`\`json
{
  "op": "replace|add|remove|move|copy|test",
  "path": "/property/path",
  "value": "new-value",  // Required for add, replace, test
  "from": "/source/path" // Required for move, copy
}
\`\`\`

## Common Issues
- Paths must start with \`/\`
- Array indices must be valid numbers or \`-\` for append
- Values must match the expected data type
- Required fields cannot be removed
- Some fields may be read-only`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error updating plan: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
