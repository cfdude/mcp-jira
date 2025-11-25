/**
 * Get detailed information about teams assigned to a strategic plan (Jira Premium feature)
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface GetPlanTeamsArgs {
  working_dir: string;
  instance?: string;
  planId: string;
}

export async function handleGetPlanTeams(args: GetPlanTeamsArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance }) => {
      try {
        const response = await axiosInstance.get(`/plans/plan/${toolArgs.planId}/team`);

        const teams = response.data;

        // Format team information for display
        const formatTeamDetails = (team: any) => {
          let details = [];

          details.push(`**ID**: ${team.id}`);
          details.push(`**Name**: ${team.name}`);
          details.push(`**Type**: ${team.type || 'Unknown'}`);

          if (team.description) {
            details.push(`**Description**: ${team.description}`);
          }

          if (team.lead) {
            details.push(`**Lead**: ${team.lead.displayName || team.lead.accountId}`);
          }

          if (team.members && team.members.length > 0) {
            details.push(`**Members**: ${team.members.length} member(s)`);
          }

          if (team.sharePermissions && team.sharePermissions.length > 0) {
            details.push(`**Permissions**: ${team.sharePermissions.length} permission rule(s)`);
          }

          if (team.organizationId) {
            details.push(`**Organization ID**: ${team.organizationId}`);
          }

          return details.join('\n');
        };

        // Format team members
        const formatTeamMembers = (members: any[]) => {
          if (!members || members.length === 0) return 'No members listed';

          return members
            .map((member, index) => {
              let memberInfo = `${index + 1}. **${member.displayName || member.accountId}**`;
              if (member.emailAddress) memberInfo += ` (${member.emailAddress})`;
              if (member.accountType) memberInfo += ` - ${member.accountType}`;
              return memberInfo;
            })
            .join('\n');
        };

        // Format permissions
        const formatPermissions = (permissions: any[]) => {
          if (!permissions || permissions.length === 0) return 'No specific permissions configured';

          return permissions
            .map((perm, index) => {
              let permInfo = `${index + 1}. **${perm.type || 'Unknown'}**`;
              if (perm.holder) {
                permInfo += ` - ${perm.holder.type}: ${perm.holder.value}`;
              }
              return permInfo;
            })
            .join('\n');
        };

        // Categorize teams by type
        const atlassianTeams = teams.filter(
          (team: any) => team.type === 'ATLAS_TEAM' || team.type === 'ATLASSIAN'
        );
        const planOnlyTeams = teams.filter(
          (team: any) => team.type === 'PLAN_ONLY' || !team.type || team.type === 'UNKNOWN'
        );
        const otherTeams = teams.filter(
          (team: any) =>
            team.type &&
            team.type !== 'ATLAS_TEAM' &&
            team.type !== 'ATLASSIAN' &&
            team.type !== 'PLAN_ONLY' &&
            team.type !== 'UNKNOWN'
        );

        return {
          content: [
            {
              type: 'text',
              text: `# Plan Teams: ${toolArgs.planId}

## 📊 Team Summary
- **Total Teams**: ${teams.length}
- **Atlassian Teams**: ${atlassianTeams.length}
- **Plan-Only Teams**: ${planOnlyTeams.length}
- **Other Team Types**: ${otherTeams.length}

${
  atlassianTeams.length > 0
    ? `## 🏢 Atlassian Teams (${atlassianTeams.length})
These are organization-wide teams managed in Atlassian Admin.

${atlassianTeams
  .map(
    (team: any, index: number) => `### ${index + 1}. ${team.name}
${formatTeamDetails(team)}

#### Team Members (${team.members?.length || 0})
${formatTeamMembers(team.members)}

#### Permissions
${formatPermissions(team.sharePermissions)}

---`
  )
  .join('\n')}`
    : ''
}

${
  planOnlyTeams.length > 0
    ? `## 📋 Plan-Only Teams (${planOnlyTeams.length})
These teams exist only within this plan and are not organization-wide.

${planOnlyTeams
  .map(
    (team: any, index: number) => `### ${index + 1}. ${team.name}
${formatTeamDetails(team)}

#### Team Members (${team.members?.length || 0})
${formatTeamMembers(team.members)}

#### Permissions
${formatPermissions(team.sharePermissions)}

---`
  )
  .join('\n')}`
    : ''
}

${
  otherTeams.length > 0
    ? `## 🔧 Other Teams (${otherTeams.length})
Teams with specialized or custom types.

${otherTeams
  .map(
    (team: any, index: number) => `### ${index + 1}. ${team.name}
${formatTeamDetails(team)}

#### Team Members (${team.members?.length || 0})
${formatTeamMembers(team.members)}

#### Permissions
${formatPermissions(team.sharePermissions)}

---`
  )
  .join('\n')}`
    : ''
}

${
  teams.length === 0
    ? `## 📭 No Teams Assigned

This plan currently has no teams assigned. Teams help organize work and provide:

- **Capacity Planning**: Understand team workload and availability
- **Resource Allocation**: Assign work to appropriate teams
- **Progress Tracking**: Monitor team-specific progress
- **Collaboration**: Facilitate cross-team coordination

### Adding Teams
- Use \`add-plan-team\` to assign existing Atlassian teams
- Create plan-only teams for specialized groupings
- Consider team capacity when assigning work`
    : ''
}

## 📈 Team Statistics
${
  teams.length > 0
    ? `
**Total Members Across All Teams**: ${teams.reduce((total: number, team: any) => total + (team.members?.length || 0), 0)}

**Teams by Member Count**:
${teams.map((team: any) => `- ${team.name}: ${team.members?.length || 0} members`).join('\n')}

**Permission Distribution**:
${teams.map((team: any) => `- ${team.name}: ${team.sharePermissions?.length || 0} permission rules`).join('\n')}`
    : 'No statistics available - no teams assigned'
}

## 💡 Team Management Tips
- **Atlassian Teams**: Best for permanent, organization-wide teams
- **Plan-Only Teams**: Useful for temporary project groupings or cross-functional teams
- **Regular Review**: Periodically review team assignments as project needs evolve
- **Clear Responsibilities**: Ensure each team understands their role in the plan
- **Capacity Management**: Monitor team workload to prevent overallocation

## 🔗 Available Actions
- Use \`add-plan-team\` to assign additional teams to this plan
- Use \`remove-plan-team\` to remove teams from this plan
- Use \`get-plan\` to view overall plan details including team summary
- Use \`update-plan\` to modify team-related configurations

## ⚠️ Note
Plans are a Jira Premium feature requiring Advanced Roadmaps. Team management capabilities depend on your organization's Atlassian setup and permissions.`,
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
                text: `# Plan Teams Not Found

Could not retrieve teams for plan \`${toolArgs.planId}\`. This could be due to:

- **Invalid Plan ID**: The plan ID may not exist or may have been deleted
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled
- **Instance Type**: Plans may not be available in your Jira instance type

## Troubleshooting Steps
1. **Verify Plan ID**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Plan Existence**: Use \`get-plan\` to verify the plan exists
3. **Contact Administrator**: If you believe this plan should exist, contact your Jira administrator

## Alternative Actions
- Use \`list-plans\` to see all available plans
- Use \`get-plan\` to view basic plan information including team count`,
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

You don't have permission to view teams for plan \`${toolArgs.planId}\`. This could be due to:

- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Permissions**: You may not have the necessary permissions to view plan teams
- **Plan Permissions**: The plan may have specific view permissions that exclude you

## Alternative Planning Approaches
Consider using these alternatives for team planning:
- **Project Roles**: Use project roles to organize team members
- **User Groups**: Create user groups for team management
- **Components**: Use components to assign work to specific teams
- **Labels**: Use labels to categorize work by team

Contact your Jira administrator if you need access to the Plans feature.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving plan teams: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
    session
  );
}
