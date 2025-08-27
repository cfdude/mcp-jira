/**
 * Handler for the list_issues tool with multi-instance support
 */
import { ListIssuesArgs, JiraSearchRequestBody } from '../types.js';
import {
  withJiraContext,
  getStandardFields,
  formatSprintInfo,
  formatStoryPoints,
  validateNextPageToken,
  handlePaginationError,
} from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';
import Converter from 'adf-to-md';

/**
 * Convert ADF to truncated Markdown for list view
 */
function convertADFToTruncatedMarkdown(adf: any, maxLength: number = 150): string {
  if (!adf) return 'No description';

  // Handle string input (already plain text)
  if (typeof adf === 'string') {
    return adf.length > maxLength ? adf.substring(0, maxLength) + '...' : adf;
  }

  // Handle non-object input
  if (typeof adf !== 'object') {
    return String(adf);
  }

  try {
    // Use adf-to-md library to convert ADF to Markdown
    const conversionResult = Converter.convert(adf);

    // The library returns an object with { result: string, warnings: Set }
    let markdown: string;
    if (typeof conversionResult === 'object' && conversionResult.result) {
      markdown = conversionResult.result;
    } else if (typeof conversionResult === 'string') {
      markdown = conversionResult;
    } else {
      return 'No description';
    }

    if (!markdown) return 'No description';

    // Clean up the markdown for list view - remove excessive line breaks
    const cleanedMarkdown = markdown
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/\n/g, ' '); // Replace newlines with spaces for single-line display

    // Truncate if too long
    return cleanedMarkdown.length > maxLength
      ? cleanedMarkdown.substring(0, maxLength) + '...'
      : cleanedMarkdown;
  } catch (error) {
    console.error('Error converting ADF to Markdown:', error);
    return '[Rich text content]';
  }
}

export async function handleListIssues(args: ListIssuesArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (
      { status, projectKey, sortField, sortOrder, epic_key, maxResults, nextPageToken },
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

      // Get fields to retrieve using helper function
      const fields = getStandardFields(projectConfig);

      // Search for issues using POST method with fields in request body
      // Use provided maxResults or default to 20 for performance
      const effectiveMaxResults = maxResults || 20;

      // Build request body with optional nextPageToken
      const requestBody: JiraSearchRequestBody = {
        jql,
        fields: fields,
        maxResults: effectiveMaxResults,
      };

      // Validate and add nextPageToken if provided for pagination
      validateNextPageToken(nextPageToken);
      if (nextPageToken) {
        requestBody.nextPageToken = nextPageToken;
      }

      let searchResponse;
      try {
        searchResponse = await axiosInstance.post('/search/jql', requestBody);
      } catch (error: any) {
        handlePaginationError(error);
      }

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
          // Handle description - could be null, string, or ADF object
          const description = convertADFToTruncatedMarkdown(issue.fields.description);
          formattedIssue += `\n- Description: ${description}`;
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

      let output = `Latest Jira Issues in ${effectiveProjectKey} Project:\n\n${formattedIssues}\n\nTotal Issues: ${issues.length}`;

      // Add pagination info if nextPageToken is available for more results
      if (searchResponse.data.nextPageToken) {
        output += `\n\n📄 **Pagination**: More results available. To get the next ${effectiveMaxResults} issues, use:\n`;
        output += `nextPageToken: "${searchResponse.data.nextPageToken}"`;
      } else {
        output += `\n\n📄 **Pagination**: End of results (no more pages available)`;
      }

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
