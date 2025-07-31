/**
 * Handler for the list_issues tool with multi-instance support
 */
import { ListIssuesArgs } from '../types.js';
import {
  withJiraContext,
  getStandardFields,
  formatSprintInfo,
  formatStoryPoints,
} from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

export async function handleListIssues(args: ListIssuesArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (
      { status, projectKey, sortField, sortOrder, epic_key },
      { axiosInstance, projectConfig, projectKey: resolvedProjectKey }
    ) => {
      // Use the provided projectKey or fall back to resolved project key
      const effectiveProjectKey = projectKey || resolvedProjectKey;

      if (!effectiveProjectKey) {
        throw new Error(
          'projectKey is required for listing issues. Please specify which project to list issues from.'
        );
      }

      // Default sort field is Rank (cf[10019]) and default order is ASC
      const effectiveSortField = sortField || 'cf[10019]';
      const effectiveSortOrder = sortOrder || 'ASC';

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

      // Get fields to retrieve using helper function
      const fields = getStandardFields(projectConfig);

      // Search for issues
      const searchResponse = await axiosInstance.get('/search', {
        params: {
          jql,
          fields,
        },
      });

      // Process each issue to create custom formatted output with sprint information
      const issues = searchResponse.data.issues;
      const formattedIssues = issues
        .map((issue: any) => {
          // Create basic issue info
          let formattedIssue = `${issue.key}: ${issue.fields.summary}
- Type: ${issue.fields.issuetype.name}
- Status: ${issue.fields.status.name}
- Priority: ${issue.fields.priority?.name || 'Not set'}
- Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`;

          // Add story points and sprint info using helper functions
          formattedIssue += formatStoryPoints(issue, projectConfig);
          formattedIssue += formatSprintInfo(issue, projectConfig);

          // Add Rank information if available
          if (issue.fields.customfield_10019) {
            formattedIssue += `\n- Rank: ${issue.fields.customfield_10019}`;
          }

          // Add remaining issue information
          formattedIssue += `\n- Created: ${new Date(issue.fields.created).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }
          )}`;
          formattedIssue += `\n- Description: ${issue.fields.description || 'No description'}`;
          formattedIssue += `\n- Creator: ${issue.fields.creator.displayName}`;

          // Add labels if any exist
          if (issue.fields.labels && issue.fields.labels.length > 0) {
            formattedIssue += `\n- Labels: ${issue.fields.labels.join(', ')}`;
          }

          // Add Epic link information if available (parent field)
          if (issue.fields.parent) {
            formattedIssue += `\n- Epic Link: ${issue.fields.parent.key}`;
          }

          return formattedIssue;
        })
        .join('\n\n' + '='.repeat(80) + '\n\n');

      const output = `Latest Jira Issues in ${effectiveProjectKey} Project:\n\n${formattedIssues}\n\nTotal Issues: ${issues.length}`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    },
    session
  );
}
