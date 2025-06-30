/**
 * Create a new strategic plan for high-level roadmap management (Jira Premium feature)
 */
import { withJiraContext } from "../utils/tool-wrapper.js";

interface CreatePlanArgs {
  working_dir: string;
  instance?: string;
  name: string;
  leadAccountId?: string;
  issueSources: Array<{
    type: "Project" | "Board" | "Filter";
    value: number;
  }>;
  scheduling?: {
    estimation?: "StoryPoints" | "Days" | "Hours";
    startDate?: {
      type: "DueDate" | "TargetStartDate" | "TargetEndDate" | "DateCustomField";
      dateCustomFieldId?: number;
    };
    endDate?: {
      type: "DueDate" | "TargetStartDate" | "TargetEndDate" | "DateCustomField";
      dateCustomFieldId?: number;
    };
    inferredDates?: "None" | "SprintDates" | "ReleaseDates";
    dependencies?: "Sequential" | "Concurrent";
  };
  exclusionRules?: {
    numberOfDaysToShowCompletedIssues?: number;
    issueIds?: number[];
    workStatusIds?: number[];
    workStatusCategoryIds?: number[];
    issueTypeIds?: number[];
    releaseIds?: number[];
  };
  crossProjectReleases?: Array<{
    name: string;
    releaseIds: number[];
  }>;
  customFields?: Array<{
    customFieldId: number;
    filter: boolean;
  }>;
  permissions?: Array<{
    type: "View" | "Edit";
    holder: {
      type: "Group" | "AccountId";
      value: string;
    };
  }>;
  useGroupId?: boolean;
}

export async function handleCreatePlan(args: CreatePlanArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance }) => {
      try {
        const requestBody: any = {
          name: toolArgs.name,
          issueSources: toolArgs.issueSources,
        };

        // Add optional fields
        if (toolArgs.leadAccountId) {
          requestBody.leadAccountId = toolArgs.leadAccountId;
        }

        if (toolArgs.scheduling) {
          requestBody.scheduling = toolArgs.scheduling;
        }

        if (toolArgs.exclusionRules) {
          requestBody.exclusionRules = toolArgs.exclusionRules;
        }

        if (toolArgs.crossProjectReleases) {
          requestBody.crossProjectReleases = toolArgs.crossProjectReleases;
        }

        if (toolArgs.customFields) {
          requestBody.customFields = toolArgs.customFields;
        }

        if (toolArgs.permissions) {
          requestBody.permissions = toolArgs.permissions;
        }

        const params: any = {};
        if (toolArgs.useGroupId) {
          params.useGroupId = toolArgs.useGroupId;
        }

        const response = await axiosInstance.post(
          `/rest/api/3/plans/plan`,
          requestBody,
          { params }
        );

        const planId = response.data;

        return {
          content: [
            {
              type: "text",
              text: `# Plan Created Successfully

## 📋 Plan Details
- **Plan ID**: ${planId}
- **Name**: ${toolArgs.name}
- **Lead**: ${toolArgs.leadAccountId || "Not specified"}
- **Issue Sources**: ${toolArgs.issueSources.length} configured

## 🎯 Issue Sources
${toolArgs.issueSources.map((source, index) => 
  `${index + 1}. **${source.type}** (ID: ${source.value})`
).join('\n')}

${toolArgs.scheduling ? `## ⏱️ Scheduling Configuration
- **Estimation Method**: ${toolArgs.scheduling.estimation || "Not specified"}
- **Dependencies**: ${toolArgs.scheduling.dependencies || "Not specified"}
- **Inferred Dates**: ${toolArgs.scheduling.inferredDates || "Not specified"}
${toolArgs.scheduling.startDate ? `- **Start Date Type**: ${toolArgs.scheduling.startDate.type}` : ""}
${toolArgs.scheduling.endDate ? `- **End Date Type**: ${toolArgs.scheduling.endDate.type}` : ""}` : ""}

${toolArgs.exclusionRules ? `## 🚫 Exclusion Rules
${toolArgs.exclusionRules.numberOfDaysToShowCompletedIssues ? `- **Completed Issues Display**: ${toolArgs.exclusionRules.numberOfDaysToShowCompletedIssues} days` : ""}
${toolArgs.exclusionRules.issueIds?.length ? `- **Excluded Issues**: ${toolArgs.exclusionRules.issueIds.length} issues` : ""}
${toolArgs.exclusionRules.workStatusIds?.length ? `- **Excluded Statuses**: ${toolArgs.exclusionRules.workStatusIds.length} statuses` : ""}
${toolArgs.exclusionRules.issueTypeIds?.length ? `- **Excluded Issue Types**: ${toolArgs.exclusionRules.issueTypeIds.length} types` : ""}
${toolArgs.exclusionRules.releaseIds?.length ? `- **Excluded Releases**: ${toolArgs.exclusionRules.releaseIds.length} releases` : ""}` : ""}

${toolArgs.crossProjectReleases?.length ? `## 🔗 Cross-Project Releases
${toolArgs.crossProjectReleases.map((release, index) => 
  `${index + 1}. **${release.name}** (${release.releaseIds.length} releases)`
).join('\n')}` : ""}

${toolArgs.customFields?.length ? `## 🔧 Custom Fields
${toolArgs.customFields.map((field, index) => 
  `${index + 1}. Field ID ${field.customFieldId} (${field.filter ? "Filter enabled" : "Filter disabled"})`
).join('\n')}` : ""}

${toolArgs.permissions?.length ? `## 🔐 Permissions
${toolArgs.permissions.map((perm, index) => 
  `${index + 1}. **${perm.type}** access for ${perm.holder.type}: ${perm.holder.value}`
).join('\n')}` : ""}

## 💡 Next Steps
- Use \`get-plan\` with ID ${planId} to view full plan details
- Use \`add-plan-team\` to assign teams to this plan
- Use \`update-plan\` to modify plan configuration
- Access the plan in Jira's Advanced Roadmaps interface

## ⚠️ Note
Plans are a Jira Premium feature requiring Advanced Roadmaps. Ensure your instance has this feature enabled and you have appropriate permissions.`,
            },
          ],
        };
      } catch (error: any) {
        // Check if it's a 404 or permission error (feature not available)
        if (error.response?.status === 404 || error.response?.status === 403) {
          return {
            content: [
              {
                type: "text",
                text: `# Plans Feature Not Available

The Plans feature is not available in this Jira instance. This could be due to:

- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Permissions**: You may not have the "Administer Jira" global permission
- **Instance Type**: Plans may not be available in your Jira instance type

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
              text: `Error creating plan: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}