/**
 * Get detailed information about a specific strategic plan (Jira Premium feature)
 */
import { withJiraContext } from "../utils/tool-wrapper.js";

interface GetPlanArgs {
  working_dir: string;
  instance?: string;
  planId: string;
}

export async function handleGetPlan(args: GetPlanArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance }) => {
      try {
        const response = await axiosInstance.get(
          `/rest/api/3/plans/plan/${toolArgs.planId}`
        );

        const plan = response.data;

        // Format issue sources for display
        const formatIssueSources = (sources: any[]) => {
          if (!sources || sources.length === 0) return "No issue sources configured";
          return sources.map((source, index) => 
            `${index + 1}. **${source.type}** (ID: ${source.value})${source.name ? ` - ${source.name}` : ""}`
          ).join('\n');
        };

        // Format teams for display
        const formatTeams = (teams: any[]) => {
          if (!teams || teams.length === 0) return "No teams assigned";
          return teams.map((team, index) => 
            `${index + 1}. **${team.name}** (ID: ${team.id})${team.type ? ` - ${team.type}` : ""}`
          ).join('\n');
        };

        // Format scheduling information
        const formatScheduling = (scheduling: any) => {
          if (!scheduling) return "No scheduling configuration";
          
          let result = [];
          if (scheduling.estimation) result.push(`- **Estimation Method**: ${scheduling.estimation}`);
          if (scheduling.dependencies) result.push(`- **Dependencies**: ${scheduling.dependencies}`);
          if (scheduling.inferredDates) result.push(`- **Inferred Dates**: ${scheduling.inferredDates}`);
          if (scheduling.startDate) result.push(`- **Start Date Source**: ${scheduling.startDate.type}`);
          if (scheduling.endDate) result.push(`- **End Date Source**: ${scheduling.endDate.type}`);
          
          return result.length > 0 ? result.join('\n') : "Basic scheduling configuration";
        };

        // Format exclusion rules
        const formatExclusionRules = (rules: any) => {
          if (!rules) return "No exclusion rules configured";
          
          let result = [];
          if (rules.numberOfDaysToShowCompletedIssues) {
            result.push(`- **Completed Issues Display**: Show for ${rules.numberOfDaysToShowCompletedIssues} days`);
          }
          if (rules.issueIds?.length) {
            result.push(`- **Excluded Issues**: ${rules.issueIds.length} specific issues`);
          }
          if (rules.workStatusIds?.length) {
            result.push(`- **Excluded Work Statuses**: ${rules.workStatusIds.length} statuses`);
          }
          if (rules.workStatusCategoryIds?.length) {
            result.push(`- **Excluded Status Categories**: ${rules.workStatusCategoryIds.length} categories`);
          }
          if (rules.issueTypeIds?.length) {
            result.push(`- **Excluded Issue Types**: ${rules.issueTypeIds.length} types`);
          }
          if (rules.releaseIds?.length) {
            result.push(`- **Excluded Releases**: ${rules.releaseIds.length} releases`);
          }
          
          return result.length > 0 ? result.join('\n') : "Basic exclusion rules";
        };

        // Format cross-project releases
        const formatCrossProjectReleases = (releases: any[]) => {
          if (!releases || releases.length === 0) return "No cross-project releases configured";
          return releases.map((release, index) => 
            `${index + 1}. **${release.name}** (${release.releaseIds?.length || 0} releases)`
          ).join('\n');
        };

        // Format custom fields
        const formatCustomFields = (fields: any[]) => {
          if (!fields || fields.length === 0) return "No custom fields configured";
          return fields.map((field, index) => 
            `${index + 1}. Field ID: ${field.customFieldId} (${field.filter ? "Filter enabled" : "Filter disabled"})`
          ).join('\n');
        };

        // Format permissions
        const formatPermissions = (permissions: any[]) => {
          if (!permissions || permissions.length === 0) return "Default permissions";
          return permissions.map((perm, index) => 
            `${index + 1}. **${perm.type}** access - ${perm.holder.type}: ${perm.holder.value}`
          ).join('\n');
        };

        // Calculate timeline status
        const calculateTimelineStatus = (startDate?: string, endDate?: string) => {
          if (!startDate || !endDate) return "⚪ Unknown";
          
          const today = new Date();
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (today < start) return "⏳ Future";
          if (today > end) return "🔴 Past Due";
          return "🟢 Active";
        };

        const timelineStatus = calculateTimelineStatus(plan.startDate, plan.endDate);

        return {
          content: [
            {
              type: "text",
              text: `# Plan Details: ${plan.name}

## 📋 Basic Information
- **Plan ID**: ${plan.id}
- **Name**: ${plan.name}
- **Description**: ${plan.description || "No description provided"}
- **Status**: ${plan.status || "Unknown"}
- **Timeline Status**: ${timelineStatus}
- **Owner**: ${plan.owner?.displayName || "No owner assigned"}
- **Owner Account ID**: ${plan.owner?.accountId || "N/A"}

## 📅 Timeline
- **Start Date**: ${plan.startDate || "Not set"}
- **End Date**: ${plan.endDate || "Not set"}
- **Created**: ${plan.createdDate ? new Date(plan.createdDate).toLocaleDateString() : "Unknown"}
- **Last Updated**: ${plan.updatedDate ? new Date(plan.updatedDate).toLocaleDateString() : "Unknown"}

## 🎯 Issue Sources (${plan.issueSources?.length || 0})
${formatIssueSources(plan.issueSources)}

## 👥 Teams (${plan.teams?.length || 0})
${formatTeams(plan.teams)}

## ⏱️ Scheduling Configuration
${formatScheduling(plan.scheduling)}

## 🚫 Exclusion Rules
${formatExclusionRules(plan.exclusionRules)}

## 🔗 Cross-Project Releases (${plan.crossProjectReleases?.length || 0})
${formatCrossProjectReleases(plan.crossProjectReleases)}

## 🔧 Custom Fields (${plan.customFields?.length || 0})
${formatCustomFields(plan.customFields)}

## 🔐 Permissions
${formatPermissions(plan.permissions)}

## 📊 Statistics
- **Projects Connected**: ${plan.projectIds?.length || 0}
- **Categories**: ${plan.categoryIds?.length || 0}
- **Total Issues**: ${plan.issueCount || "Unknown"}
- **Team Count**: ${plan.teams?.length || 0}

## 🔗 API Reference
- **Self URL**: ${plan.self || "N/A"}

## 💡 Available Actions
- Use \`update-plan\` to modify this plan's configuration
- Use \`get-plan-teams\` to view detailed team information
- Use \`add-plan-team\` to assign additional teams
- Use \`remove-plan-team\` to remove teams from this plan
- Use \`archive-plan\` to archive this plan when completed
- Use \`duplicate-plan\` to create a copy of this plan

## ⚠️ Note
Plans are a Jira Premium feature requiring Advanced Roadmaps. Ensure your instance has this feature enabled and you have appropriate permissions.`,
            },
          ],
        };
      } catch (error: any) {
        // Check if it's a 404 error (plan not found or feature not available)
        if (error.response?.status === 404) {
          return {
            content: [
              {
                type: "text",
                text: `# Plan Not Found

The plan with ID \`${toolArgs.planId}\` could not be found. This could be due to:

- **Invalid Plan ID**: The plan ID may not exist or may have been deleted
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Permissions**: You may not have permission to view this plan
- **Instance Type**: Plans may not be available in your Jira instance type

## Troubleshooting Steps
1. **Verify Plan ID**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Permissions**: Ensure you have the necessary permissions to view plans
3. **Contact Administrator**: If you believe this plan should exist, contact your Jira administrator

## Alternative Actions
- Use \`list-plans\` to see all available plans
- Use \`create-plan\` to create a new strategic plan
- Consider using epics, versions, or components for project planning`,
              },
            ],
          };
        }

        // Check if it's a 403 error (permission denied)
        if (error.response?.status === 403) {
          return {
            content: [
              {
                type: "text",
                text: `# Access Denied

You don't have permission to view plan \`${toolArgs.planId}\`. This could be due to:

- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Permissions**: You may not have the "Browse Projects" or "Administer Jira" permission
- **Plan Permissions**: The plan may have specific view permissions that exclude you

## Alternative Planning Approaches
Consider using these alternatives for strategic planning:
- **Epics**: Use epics to group related work and track high-level progress
- **Versions**: Create versions/releases to organize work by timeline
- **Labels**: Use labels to categorize and filter issues by initiative
- **Components**: Organize work by feature areas or system components
- **Dashboards**: Create custom dashboards to track progress across projects

Contact your Jira administrator if you need access to the Plans feature.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error retrieving plan: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}