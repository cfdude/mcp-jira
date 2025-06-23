/**
 * Handler for the get_issue tool with multi-instance support
 */
import { GetIssueArgs } from "../types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";

export async function handleGetIssue(args: GetIssueArgs) {
  const { issue_key, working_dir, instance } = args;
  
  // Extract project key from issue key (e.g., "MIG-123" -> "MIG")
  const projectKey = issue_key.split('-')[0];
  
  // Get the appropriate instance and project configuration
  const { instance: instanceConfig, projectConfig } = await getInstanceForProject(
    working_dir, 
    projectKey, 
    instance
  );
  
  // Create API instances for this specific Jira instance
  const { axiosInstance } = createJiraApiInstances(instanceConfig);
  
  console.error(`Getting issue ${issue_key} from project ${projectKey} using instance: ${instanceConfig.domain}`);
  
  // Get specific fields to retrieve
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

  const issueResponse = await axiosInstance.get(`/issue/${issue_key}`, {
    params: {
      fields: fields.join(",")
    }
  });

  // Create a custom formatted issue output with sprint information
  let standardIssueInfo = `${issueResponse.data.key}: ${issueResponse.data.fields.summary}
- Type: ${issueResponse.data.fields.issuetype.name}
- Status: ${issueResponse.data.fields.status.name}
- Priority: ${issueResponse.data.fields.priority?.name || "Not set"}
- Assignee: ${issueResponse.data.fields.assignee?.displayName || "Unassigned"}`;

  // Add Story Points if configured and available
  if (projectConfig.storyPointsField && issueResponse.data.fields[projectConfig.storyPointsField] !== undefined) {
    standardIssueInfo += `\n- Story Points: ${issueResponse.data.fields[projectConfig.storyPointsField] || "Not set"}`;
  }
  
  // Add Rank information if available
  if (issueResponse.data.fields.customfield_10019) {
    standardIssueInfo += `\n- Rank: ${issueResponse.data.fields.customfield_10019}`;
  }

  // Add Sprint information if available
  const sprintField = projectConfig.sprintField || 'customfield_10020';
  if (issueResponse.data.fields[sprintField] &&
      Array.isArray(issueResponse.data.fields[sprintField]) &&
      issueResponse.data.fields[sprintField].length > 0) {
    
    const sprint = issueResponse.data.fields[sprintField][0];
    
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
      
      standardIssueInfo += `\n- Sprint: ${sprintName} (ID: ${sprintId}, State: ${sprintState})`;
      standardIssueInfo += `\n- Sprint Dates: ${startDate} to ${endDate}`;
    }
  }

  // Add remaining issue information
  standardIssueInfo += `\n- Created: ${new Date(issueResponse.data.fields.created).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
  standardIssueInfo += `\n- Description: ${issueResponse.data.fields.description || "No description"}`;
  standardIssueInfo += `\n- Creator: ${issueResponse.data.fields.creator.displayName}`;
  
  // Add labels if any exist
  if (issueResponse.data.fields.labels && issueResponse.data.fields.labels.length > 0) {
    standardIssueInfo += `\n- Labels: ${issueResponse.data.fields.labels.join(", ")}`;
  }
  
  // Add Epic link information if available (parent field)
  if (issueResponse.data.fields.parent) {
    standardIssueInfo += `\n- Epic Link: ${issueResponse.data.fields.parent.key}`;
  }

  // Add comments if available
  if (issueResponse.data.fields.comment && issueResponse.data.fields.comment.comments.length > 0) {
    standardIssueInfo += `\n- Comments: ${issueResponse.data.fields.comment.comments.length} comment(s)`;
    
    // Show latest comment
    const latestComment = issueResponse.data.fields.comment.comments[issueResponse.data.fields.comment.comments.length - 1];
    const commentDate = new Date(latestComment.created).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric", 
      year: "numeric",
    });
    standardIssueInfo += `\n- Latest Comment: "${latestComment.body.substring(0, 100)}${latestComment.body.length > 100 ? '...' : ''}" by ${latestComment.author.displayName} on ${commentDate}`;
  }

  return {
    content: [
      {
        type: "text",
        text: standardIssueInfo
      }
    ]
  };
}