/**
 * Add a team to a strategic plan (Jira Premium feature)
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface AddPlanTeamArgs {
  working_dir: string;
  instance?: string;
  planId: string;
  teamId: string;
}

export async function handleAddPlanTeam(args: AddPlanTeamArgs, _session?: SessionState) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      const response = await axiosInstance.put(
        `/plans/plan/${toolArgs.planId}/team/${toolArgs.teamId}`
      );

      // The response typically contains the updated team information
      const teamData = response.data;

      return {
        content: [
          {
            type: 'text',
            text: `# Team Added Successfully

## ✅ Operation Complete
Team \`${toolArgs.teamId}\` has been successfully added to plan \`${toolArgs.planId}\`.

## 📋 Team Assignment Details
- **Plan ID**: ${toolArgs.planId}
- **Team ID**: ${toolArgs.teamId}
- **Date Added**: ${new Date().toLocaleString()}
- **Status**: Active

${
  teamData && teamData.name
    ? `## 👥 Team Information
- **Team Name**: ${teamData.name}
- **Team Type**: ${teamData.type || 'Unknown'}
- **Members**: ${teamData.members?.length || 'Unknown'} member(s)
- **Description**: ${teamData.description || 'No description available'}`
    : ''
}

## 🎯 What This Means
Adding a team to a plan provides several benefits:

### **Capacity Planning**
- Team workload can now be tracked within this plan
- Capacity-based scheduling becomes available
- Resource allocation insights are enabled

### **Work Assignment**
- Issues in this plan can be assigned to team members
- Team-specific views and filters become available
- Progress tracking is organized by team

### **Collaboration**
- Team members gain visibility into plan objectives
- Cross-team dependencies can be better managed
- Communication and coordination are enhanced

### **Reporting**
- Team-specific progress reports are now available
- Velocity and productivity metrics can be tracked
- Resource utilization can be monitored

## 🔄 Plan Impact
This team addition affects:
- **Issue Assignment**: Issues can now be assigned to this team's members
- **Capacity Calculations**: Team capacity is included in plan scheduling
- **Progress Tracking**: Team progress contributes to overall plan metrics
- **Reporting**: Team-specific data appears in plan reports and dashboards

## 💡 Next Steps
- Use \`get-plan-teams\` to view all teams assigned to this plan
- Use \`get-plan\` to see the updated plan overview including team count
- Review team member assignments and workload distribution
- Configure team-specific scheduling and capacity settings if needed
- Consider adding more teams if the plan scope requires additional resources

## 🔗 Related Actions
- **View Team Details**: Use \`get-plan-teams\` to see detailed team information
- **Remove Team**: Use \`remove-plan-team\` if you need to remove this team later
- **Plan Overview**: Use \`get-plan\` to view the updated plan summary
- **Update Team Config**: Use \`update-plan\` to modify team-related settings

## ⚠️ Important Notes
- Teams added to plans should have relevant skills for the plan's objectives
- Consider team capacity and existing commitments before assignment
- Ensure team members understand their role in the plan
- Regular review of team assignments helps maintain plan effectiveness

Plans are a Jira Premium feature requiring Advanced Roadmaps. Ensure your instance has this feature enabled and you have appropriate permissions.`,
          },
        ],
      };
    } catch (error: any) {
      // Check for specific error types
      if (error.response?.status === 404) {
        // Could be plan not found or team not found
        return {
          content: [
            {
              type: 'text',
              text: `# Resource Not Found

Could not add team \`${toolArgs.teamId}\` to plan \`${toolArgs.planId}\`. This could be due to:

## Possible Causes
- **Invalid Plan ID**: The plan \`${toolArgs.planId}\` may not exist or may have been deleted
- **Invalid Team ID**: The team \`${toolArgs.teamId}\` may not exist or may not be accessible
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled
- **Instance Type**: Plans may not be available in your Jira instance type

## Troubleshooting Steps
1. **Verify Plan ID**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Plan Existence**: Use \`get-plan\` to verify the plan exists
3. **Verify Team ID**: Ensure the team ID is correct and the team exists in your organization
4. **Check Team Access**: Verify you have access to the team you're trying to add
5. **Contact Administrator**: If both resources should exist, contact your Jira administrator

## Finding Team IDs
Team IDs can be found through:
- Atlassian Admin interface (for organization teams)
- Team management APIs
- Your Jira administrator
- Existing plan team listings using \`get-plan-teams\` on other plans

## Alternative Actions
- Use \`list-plans\` to see all available plans
- Create a new plan if the target plan doesn't exist
- Create a plan-only team if the team doesn't exist organizationally`,
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

You don't have permission to add team \`${toolArgs.teamId}\` to plan \`${toolArgs.planId}\`. This could be due to:

## Permission Issues
- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Plan Permissions**: You may not have edit permissions for this plan
- **Team Access Restrictions**: You may not have permission to assign this team
- **Global Permissions**: You may lack the "Administer Jira" global permission

## Resolution Steps
1. **Contact Plan Owner**: Ask the plan owner to add the team
2. **Request Permissions**: Ask your Jira administrator for plan edit permissions
3. **Check Team Access**: Verify you have access to manage the team
4. **Feature Verification**: Confirm Plans feature is enabled for your instance

## Alternative Approaches
- Ask a plan administrator to add the team for you
- Use project-level team assignment instead of plan-level
- Create plan-only teams that you can manage within the plan scope

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

The request to add team \`${toolArgs.teamId}\` to plan \`${toolArgs.planId}\` could not be processed. This could be due to:

## Common Issues
- **Team Already Assigned**: The team may already be assigned to this plan
- **Invalid Team ID Format**: The team ID format may be incorrect
- **Plan Capacity Limits**: The plan may have reached its team limit
- **Team Type Restrictions**: The team type may not be compatible with this plan

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## Troubleshooting
1. **Check Current Teams**: Use \`get-plan-teams\` to see currently assigned teams
2. **Verify Team ID**: Ensure the team ID is in the correct format
3. **Plan Limits**: Check if there are limits on team assignments
4. **Team Compatibility**: Verify the team type is compatible with plan requirements

## Team ID Formats
Different team types may have different ID formats:
- **Atlassian Teams**: Usually UUID format (e.g., \`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\`)
- **Plan-Only Teams**: May use different ID schemes
- **Legacy Teams**: Could have numeric or string IDs`,
            },
          ],
        };
      }

      if (error.response?.status === 409) {
        return {
          content: [
            {
              type: 'text',
              text: `# Team Already Assigned

Team \`${toolArgs.teamId}\` is already assigned to plan \`${toolArgs.planId}\`.

## Current Status
The team you're trying to add is already part of this plan. No action is needed.

## Next Steps
- Use \`get-plan-teams\` to view all currently assigned teams
- Use \`get-plan\` to see the plan overview including team information
- If you need to modify team settings, use \`update-plan\` with appropriate JSON patch operations

## If You Expected This to Work
This might happen if:
- The team was previously added by another user
- The operation was already completed in a previous request
- There was a delay in the system updating team assignments`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error adding team to plan: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
