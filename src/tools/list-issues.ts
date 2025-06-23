/**
 * Handler for the list_issues tool with multi-instance support
 */
import { ListIssuesArgs } from "../types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";

export async function handleListIssues(args: ListIssuesArgs) {
  // Extract parameters with defaults
  const { status, projectKey, sortField, sortOrder, epic_key, working_dir, instance } = args;
  
  // Default sort field is Rank (cf[10019]) and default order is ASC
  const effectiveSortField = sortField || 'cf[10019]';
  const effectiveSortOrder = sortOrder || 'ASC';
  
  // Determine which project key to use - if not provided, we need to get the first configured project
  let effectiveProjectKey = projectKey;
  if (!effectiveProjectKey) {
    // We need a project key to proceed, let's try to get one from config
    throw new Error("projectKey is required for listing issues. Please specify which project to list issues from.");
  }
  
  // Get the appropriate instance and project configuration
  const { instance: instanceConfig, projectConfig } = await getInstanceForProject(
    working_dir, 
    effectiveProjectKey, 
    instance
  );
  
  // Create API instances for this specific Jira instance
  const { axiosInstance } = createJiraApiInstances(instanceConfig);
  
  console.error(`Listing issues from project ${effectiveProjectKey} using instance: ${instanceConfig.domain}`);
  
  // Build JQL query based on filters and sort parameters
  let jqlConditions = [`project = ${effectiveProjectKey}`];
  
  if (status) {
    jqlConditions.push(`status = "${status}"`);
  }
  
  if (epic_key) {
    jqlConditions.push(`"Epic Link" = ${epic_key}`);
  }
  
  const jql = `${jqlConditions.join(' AND ')} ORDER BY ${effectiveSortField} ${effectiveSortOrder}`;
  
  console.error(`JQL Query: ${jql}`); // Log the JQL query for debugging

  // Get fields to retrieve, including story points if configured
  const fields = [
    "summary",
    "description",
    "status",
    "issuetype",
    "created",
    "creator",
    "assignee",
    "priority",
    "labels",
    "parent",
    "comment"
  ];

  // Add configured custom fields
  if (projectConfig.sprintField) {
    fields.push(projectConfig.sprintField);
  }
  if (projectConfig.storyPointsField) {
    fields.push(projectConfig.storyPointsField);
  }
  
  // Add rank field
  fields.push("customfield_10019"); // Rank field

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
- Priority: ${issue.fields.priority?.name || "Not set"}
- Assignee: ${issue.fields.assignee?.displayName || "Unassigned"}`;

    // Add Story Points if configured
    if (projectConfig.storyPointsField && issue.fields[projectConfig.storyPointsField] !== undefined) {
      formattedIssue += `\n- Story Points: ${issue.fields[projectConfig.storyPointsField] || "Not set"}`;
    }
    
    // Add Rank information if available
    if (issue.fields.customfield_10019) {
      formattedIssue += `\n- Rank: ${issue.fields.customfield_10019}`;
    }

    // Add Sprint information if available
    const sprintField = projectConfig.sprintField || 'customfield_10020';
    if (issue.fields[sprintField] &&
        Array.isArray(issue.fields[sprintField]) &&
        issue.fields[sprintField].length > 0) {
      
      const sprint = issue.fields[sprintField][0];
      
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
    
    // Add Epic link information if available (parent field)
    if (issue.fields.parent) {
      formattedIssue += `\n- Epic Link: ${issue.fields.parent.key}`;
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