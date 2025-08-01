/**
 * Remove a team from a strategic plan (Jira Premium feature)
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface RemovePlanTeamArgs {
  working_dir: string;
  instance?: string;
  planId: string;
  teamId: string;
}

export async function handleRemovePlanTeam(args: RemovePlanTeamArgs, _session?: SessionState) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      await axiosInstance.delete(`/plans/plan/${toolArgs.planId}/team/${toolArgs.teamId}`);

      return {
        content: [
          {
            type: 'text',
            text: `# Team Removed Successfully

## ✅ Operation Complete
Team \`${toolArgs.teamId}\` has been successfully removed from plan \`${toolArgs.planId}\`.

## 📋 Removal Details
- **Plan ID**: ${toolArgs.planId}
- **Team ID**: ${toolArgs.teamId}
- **Date Removed**: ${new Date().toLocaleString()}
- **Status**: Team no longer assigned to this plan

## 🔄 Plan Impact
Removing this team affects several aspects of the plan:

### **Capacity Changes**
- Team capacity is no longer included in plan scheduling calculations
- Resource allocation metrics are updated to exclude this team
- Workload distribution is recalculated without this team's capacity

### **Issue Assignment Impact**
- Issues currently assigned to this team's members remain assigned
- New issues can no longer be automatically assigned to this team
- Existing assignments may need manual review and redistribution

### **Reporting Changes**
- Team-specific progress reports are no longer generated for this plan
- Velocity and productivity metrics exclude this team's contributions going forward
- Historical data remains but new data won't include this team

### **Access and Visibility**
- Team members may lose access to plan-specific views and dashboards
- Plan visibility for team members depends on other access permissions
- Team-specific filters and searches may no longer include plan data

## ⚠️ Important Considerations

### **Existing Work Assignment**
- **Issues remain assigned**: Team members keep their current issue assignments
- **Review needed**: Consider redistributing work to remaining teams
- **Capacity planning**: Ensure remaining teams can handle the workload

### **Timeline Impact**
- **Schedule review**: Plan timeline may need adjustment without this team's capacity
- **Dependency check**: Verify no critical dependencies rely on this team
- **Milestone validation**: Confirm milestones are still achievable

### **Communication**
- **Notify stakeholders**: Inform relevant parties about the team change
- **Update documentation**: Revise plan documentation to reflect team changes
- **Team notification**: Inform removed team members about the change

## 💡 Recommended Next Steps

### **Immediate Actions**
1. **Review Assignments**: Use Jira's issue search to find work assigned to this team's members
2. **Redistribute Work**: Reassign critical tasks to remaining teams if needed
3. **Update Capacity**: Review plan capacity and timeline with reduced team resources
4. **Check Dependencies**: Verify no blocking dependencies rely on the removed team

### **Planning Actions**
1. **Timeline Review**: Assess if plan timeline needs adjustment
2. **Resource Reallocation**: Distribute work among remaining teams
3. **Stakeholder Communication**: Notify relevant parties about the change
4. **Documentation Update**: Update plan documentation and team assignments

## 🔗 Related Actions
- **View Remaining Teams**: Use \`get-plan-teams\` to see teams still assigned to this plan
- **Plan Overview**: Use \`get-plan\` to view updated plan summary
- **Add Replacement Team**: Use \`add-plan-team\` if you need to add a different team
- **Update Plan Config**: Use \`update-plan\` to adjust plan settings for the team change

## 📊 Verification Steps
To verify the removal was successful:
1. Use \`get-plan-teams\` to confirm the team is no longer listed
2. Use \`get-plan\` to see updated team count in plan summary
3. Check plan capacity and timeline calculations
4. Review issue assignments for the removed team's members

## 🔄 If You Need to Add the Team Back
If this was a mistake or you need to re-add the team:
- Use \`add-plan-team\` with the same team ID to restore the assignment
- Team members will regain plan access and visibility
- Historical data and previous assignments will be preserved

## ⚠️ Note
Plans are a Jira Premium feature requiring Advanced Roadmaps. Ensure your instance has this feature enabled and you have appropriate permissions for team management.`,
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
              text: `# Team or Plan Not Found

Could not remove team \`${toolArgs.teamId}\` from plan \`${toolArgs.planId}\`. This could be due to:

## Possible Causes
- **Invalid Plan ID**: The plan \`${toolArgs.planId}\` may not exist or may have been deleted
- **Invalid Team ID**: The team \`${toolArgs.teamId}\` may not exist or may not be assigned to this plan
- **Team Not Assigned**: The team may not currently be assigned to this plan
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled

## Troubleshooting Steps
1. **Verify Plan Exists**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Plan Details**: Use \`get-plan\` to verify the plan exists and get basic information
3. **View Current Teams**: Use \`get-plan-teams\` to see which teams are currently assigned
4. **Verify Team ID**: Ensure the team ID is correct and matches an assigned team

## Current Plan Status
To understand the current state:
- Use \`get-plan-teams\` to see all teams currently assigned to plan \`${toolArgs.planId}\`
- Use \`get-plan\` to view plan overview and team count
- Verify the team you're trying to remove is actually assigned

## If the Team Was Already Removed
If the team was already removed by another user or process:
- The operation has already been completed
- No further action is needed
- Use \`get-plan-teams\` to confirm current team assignments`,
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

You don't have permission to remove team \`${toolArgs.teamId}\` from plan \`${toolArgs.planId}\`. This could be due to:

## Permission Issues
- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Plan Permissions**: You may not have edit permissions for this plan
- **Team Management Restrictions**: You may not have permission to manage this team
- **Global Permissions**: You may lack the "Administer Jira" global permission

## Resolution Steps
1. **Contact Plan Owner**: Ask the plan owner to remove the team
2. **Request Permissions**: Ask your Jira administrator for plan edit permissions
3. **Check Team Access**: Verify you have permission to manage team assignments
4. **Feature Verification**: Confirm Plans feature is enabled and accessible

## Alternative Approaches
- Ask a plan administrator to remove the team for you
- Contact the team lead to coordinate the removal
- Request temporary permissions for plan management

Contact your Jira administrator if you need access to manage plan teams.`,
            },
          ],
        };
      }

      if (error.response?.status === 400) {
        return {
          content: [
            {
              type: 'text',
              text: `# Invalid Request

The request to remove team \`${toolArgs.teamId}\` from plan \`${toolArgs.planId}\` could not be processed. This could be due to:

## Common Issues
- **Invalid Team ID Format**: The team ID format may be incorrect
- **Team Not Assigned**: The team may not currently be assigned to this plan
- **Required Team**: The team may be required and cannot be removed
- **Active Dependencies**: The team may have active work that prevents removal

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## Troubleshooting
1. **Check Team Assignment**: Use \`get-plan-teams\` to verify the team is currently assigned
2. **Verify Team ID Format**: Ensure the team ID is in the correct format
3. **Review Dependencies**: Check if the team has active work or dependencies
4. **Plan Requirements**: Verify there are no minimum team requirements

## Before Removing Teams
Consider these factors:
- Are there active issues assigned to this team's members?
- Does the plan have minimum team requirements?
- Are there dependencies that rely on this team?
- Is this the last team assigned to the plan?`,
            },
          ],
        };
      }

      if (error.response?.status === 409) {
        return {
          content: [
            {
              type: 'text',
              text: `# Cannot Remove Team

Team \`${toolArgs.teamId}\` cannot be removed from plan \`${toolArgs.planId}\` due to a conflict. This could be due to:

## Possible Conflicts
- **Active Work Assignments**: The team has critical work assigned that must be completed or reassigned first
- **Required Team**: This team may be marked as required for the plan
- **Active Dependencies**: Other teams or work items depend on this team
- **Minimum Team Requirements**: The plan may require a minimum number of teams

## Resolution Steps
1. **Review Active Work**: Check for active issues assigned to team members
2. **Reassign Critical Tasks**: Move important work to other teams before removal
3. **Resolve Dependencies**: Address any dependencies on this team
4. **Check Plan Requirements**: Verify if this team is required for plan completion

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

Use \`get-plan-teams\` and \`get-plan\` to understand the current plan state and resolve conflicts before attempting removal again.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error removing team from plan: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
