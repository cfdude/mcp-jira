/**
 * Handler for the list_issues tool
 */
import { AxiosInstance } from "axios";
import { ListIssuesArgs } from "../types.js";
import { formatIssue, formatIssueList } from "../utils/formatting.js";

export async function handleListIssues(
  axiosInstance: AxiosInstance,
  defaultProjectKey: string,
  storyPointsField: string | null,
  args: ListIssuesArgs
) {
  const { status, projectKey } = args;
  
  // Use provided projectKey if it exists, otherwise use the default
  const effectiveProjectKey = projectKey || defaultProjectKey;
  
  // Build JQL query based on status filter
  const jql = status
    ? `project = ${effectiveProjectKey} AND status = "${status}" ORDER BY created DESC`
    : `project = ${effectiveProjectKey} ORDER BY created DESC`;

  // Get fields to retrieve, including story points if configured
  const fields = [
    "summary",
    "description",
    "status",
    "issuetype",
    "created",
    "creator",
    "priority",
    "labels",
    "parent",
    "comment",
    "customfield_10020" // Sprint field
  ];

  // Add story points field if configured
  if (storyPointsField) {
    fields.push(storyPointsField);
  }

  // Search for issues
  const searchResponse = await axiosInstance.get("/search", {
    params: {
      jql,
      fields,
    },
  });

  // Process each issue to create custom formatted output with sprint information
  const issues = searchResponse.data.issues;
  const formattedIssues = issues.map((issue: any) => {
    // Create basic issue info
    let formattedIssue = `${issue.key}: ${issue.fields.summary}
- Type: ${issue.fields.issuetype.name}
- Status: ${issue.fields.status.name}
- Priority: ${issue.fields.priority?.name || "Not set"}`;

    // Add Story Points if configured
    if (storyPointsField && issue.fields[storyPointsField] !== undefined) {
      formattedIssue += `\n- Story Points: ${issue.fields[storyPointsField] || "Not set"}`;
    }

    // Add Sprint information if available
    if (issue.fields.customfield_10020 &&
        Array.isArray(issue.fields.customfield_10020) &&
        issue.fields.customfield_10020.length > 0) {
      
      const sprint = issue.fields.customfield_10020[0];
      
      if (sprint && typeof sprint === 'object') {
        const sprintName = sprint.name || 'Unknown';
        const sprintState = sprint.state || 'Unknown';
        const sprintId = sprint.id || 'Unknown';
        const startDate = sprint.startDate ? new Date(sprint.startDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) : 'Unknown';
        const endDate = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) : 'Unknown';
        
        formattedIssue += `\n- Sprint: ${sprintName} (ID: ${sprintId}, State: ${sprintState})`;
        formattedIssue += `\n- Sprint Dates: ${startDate} to ${endDate}`;
      }
    }

    // Add remaining issue information
    formattedIssue += `\n- Created: ${new Date(issue.fields.created).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
    formattedIssue += `\n- Description: ${issue.fields.description || "No description"}`;
    formattedIssue += `\n- Creator: ${issue.fields.creator.displayName}`;
    
    // Add labels if any exist
    if (issue.fields.labels && issue.fields.labels.length > 0) {
      formattedIssue += `\n- Labels: ${issue.fields.labels.join(", ")}`;
    }
    
    // Add Epic link information if available
    for (const [fieldId, value] of Object.entries(issue.fields)) {
      if (fieldId.startsWith('customfield_') && value && typeof value === 'string') {
        formattedIssue += `\n- Epic Link: ${value}`;
      }
    }
    
    return formattedIssue;
  }).join("\n\n" + "=".repeat(80) + "\n\n");

  const output = `Latest Jira Issues in ${effectiveProjectKey} Project:\n\n${formattedIssues}\n\nTotal Issues: ${issues.length}`;

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}