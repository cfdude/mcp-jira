/**
 * List strategic plans for high-level roadmap management (Jira Premium feature)
 */
import { AxiosInstance } from "axios";

export async function handleListPlans(
  axiosInstance: AxiosInstance,
  args: any
) {
  try {
    const params: any = {};
    
    // Add optional parameters
    if (args.startAt) {
      params.startAt = args.startAt;
    }
    if (args.maxResults) {
      params.maxResults = args.maxResults;
    }

    const response = await axiosInstance.get(
      `/rest/api/3/plans/plan`,
      { params }
    );

    const data = response.data;
    const plans = data.values || [];

    // Format plans with useful information
    const formattedPlans = plans.map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description || "No description",
      status: plan.status || "Unknown",
      owner: plan.owner?.displayName || "No owner",
      ownerAccountId: plan.owner?.accountId || null,
      startDate: plan.startDate || "Not set",
      endDate: plan.endDate || "Not set",
      createdDate: plan.createdDate,
      updatedDate: plan.updatedDate,
      teamCount: plan.teams?.length || 0,
      issueCount: plan.issues?.length || 0,
      categoryIds: plan.categoryIds || [],
      projectIds: plan.projectIds || [],
      self: plan.self
    }));

    // Categorize plans by status
    const activePlans = formattedPlans.filter((p: any) => 
      p.status && p.status.toLowerCase() !== 'closed' && p.status.toLowerCase() !== 'archived'
    );
    const closedPlans = formattedPlans.filter((p: any) => 
      p.status && (p.status.toLowerCase() === 'closed' || p.status.toLowerCase() === 'archived')
    );

    // Calculate timeline information
    const today = new Date();
    const plansWithTimeline = formattedPlans.map((plan: any) => {
      const startDate = plan.startDate !== "Not set" ? new Date(plan.startDate) : null;
      const endDate = plan.endDate !== "Not set" ? new Date(plan.endDate) : null;
      
      let timelineStatus = "Unknown";
      if (startDate && endDate) {
        if (today < startDate) {
          timelineStatus = "Future";
        } else if (today > endDate) {
          timelineStatus = "Past Due";
        } else {
          timelineStatus = "Active";
        }
      }

      return { ...plan, timelineStatus };
    });

    return {
      content: [
        {
          type: "text",
          text: `# Strategic Plans Overview

## 📊 Summary
- **Total Plans**: ${formattedPlans.length}
- **Active Plans**: ${activePlans.length}
- **Closed Plans**: ${closedPlans.length}
- **Showing**: ${formattedPlans.length} of ${data.total || formattedPlans.length}

## 🚀 Active Plans (${activePlans.length})
${activePlans.length > 0 ? 
  activePlans.map((plan: any) => {
    const planWithTimeline = plansWithTimeline.find((p: any) => p.id === plan.id);
    return `### ${plan.name} (ID: ${plan.id})
- **Description**: ${plan.description}
- **Status**: ${plan.status}
- **Timeline Status**: ${planWithTimeline?.timelineStatus || "Unknown"}
- **Owner**: ${plan.owner}
- **Start Date**: ${plan.startDate}
- **End Date**: ${plan.endDate}
- **Teams**: ${plan.teamCount}
- **Issues**: ${plan.issueCount}
- **Projects**: ${plan.projectIds.length}
- **Last Updated**: ${plan.updatedDate ? new Date(plan.updatedDate).toLocaleDateString() : "Unknown"}`;
  }).join('\n\n') : 
  "No active plans found."
}

${closedPlans.length > 0 ? `
## 📦 Closed Plans (${closedPlans.length})
${closedPlans.slice(0, 5).map((plan: any) => 
  `- **${plan.name}** (${plan.status}) - Ended: ${plan.endDate}`
).join('\n')}${closedPlans.length > 5 ? `\n... and ${closedPlans.length - 5} more` : ""}
` : ""}

## 📈 Timeline Overview
${plansWithTimeline.map((plan: any) => {
  let indicator = "";
  switch (plan.timelineStatus) {
    case "Future": indicator = "⏳"; break;
    case "Active": indicator = "🟢"; break;
    case "Past Due": indicator = "🔴"; break;
    default: indicator = "⚪"; break;
  }
  return `${indicator} **${plan.name}**: ${plan.timelineStatus}`;
}).join('\n')}

## 💡 Plan Management Tips
- Use plans for high-level strategic roadmap planning
- Link multiple projects and teams to plans for coordination
- Set realistic start and end dates for better timeline management
- Regular updates help track progress against strategic goals
- Consider creating plans for quarters, releases, or major initiatives

## ⚠️ Note
Plans are a Jira Premium feature. If you don't see plans or get permission errors, your instance may not have this feature enabled or you may lack the necessary permissions.

${data.total > formattedPlans.length ? 
  `\n**Pagination**: Showing ${formattedPlans.length} of ${data.total} total plans. Use startAt and maxResults parameters to see more.` : 
  ""
}`,
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
- **Insufficient Permissions**: You may not have permission to access plans
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
          text: `Error listing plans: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}