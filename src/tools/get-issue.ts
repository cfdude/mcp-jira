/**
 * Handler for the get_issue tool with multi-instance support
 */
import { GetIssueArgs } from '../types.js';
import {
  withJiraContext,
  getStandardFields,
  formatSprintInfo,
  formatStoryPoints,
} from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';
import Converter from 'adf-to-md';

/**
 * Convert ADF to Markdown using the adf-to-md library
 */
function convertADFToMarkdown(adf: any): string {
  if (!adf) return 'No description';

  // Handle string input (already plain text)
  if (typeof adf === 'string') {
    return adf;
  }

  // Handle non-object input
  if (typeof adf !== 'object') {
    return String(adf);
  }

  try {
    // Use adf-to-md library to convert ADF to Markdown
    const conversionResult = Converter.convert(adf);

    // The library returns an object with { result: string, warnings: Set }
    if (typeof conversionResult === 'object' && conversionResult.result) {
      return conversionResult.result || 'No description';
    } else if (typeof conversionResult === 'string') {
      return conversionResult || 'No description';
    } else {
      console.error('Unexpected conversion result format:', conversionResult);
      return '[Rich text content - unable to convert]';
    }
  } catch (error) {
    console.error('Error converting ADF to Markdown:', error);
    // Fallback to showing it's complex content
    return '[Rich text content - unable to convert]';
  }
}

export async function handleGetIssue(args: GetIssueArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key }, { axiosInstance, projectConfig }) => {
      // Get issue with all relevant fields
      const fields = getStandardFields(projectConfig);
      const issueResponse = await axiosInstance.get(`/issue/${issue_key}`, {
        params: {
          fields: fields.join(','),
        },
      });

      const issue = issueResponse.data;

      // Build formatted issue information
      let standardIssueInfo = `${issue.key}: ${issue.fields.summary}
- Type: ${issue.fields.issuetype.name}
- Status: ${issue.fields.status.name}
- Priority: ${issue.fields.priority?.name || 'Not set'}
- Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`;

      // Add story points and sprint info using helper functions
      standardIssueInfo += formatStoryPoints(issue, projectConfig);
      standardIssueInfo += formatSprintInfo(issue, projectConfig);

      // Add Rank information if available
      if (issue.fields.customfield_10019) {
        standardIssueInfo += `\n- Rank: ${issue.fields.customfield_10019}`;
      }

      // Add remaining issue information
      standardIssueInfo += `\n- Created: ${new Date(issue.fields.created).toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
      )}`;
      // Safely handle description (could be string or ADF object)
      let description = 'No description';

      if (!issue.fields.description) {
        description = 'No description';
      } else if (typeof issue.fields.description === 'string') {
        description = issue.fields.description;
      } else if (typeof issue.fields.description === 'object') {
        // Handle ADF (Atlassian Document Format) - check various possible structures
        const descObj = issue.fields.description;

        // Use adf2md to convert ADF to Markdown
        description = convertADFToMarkdown(descObj);
      }

      // Ensure description is always a string before concatenation
      if (typeof description !== 'string') {
        console.error('Description is not a string:', typeof description, description);
        description = String(description);
      }

      standardIssueInfo += `\n- Description: ${description}`;

      // Handle environment field (could be string or ADF object)
      if (issue.fields.environment) {
        let environment = 'No environment';
        if (typeof issue.fields.environment === 'string') {
          environment = issue.fields.environment;
        } else if (typeof issue.fields.environment === 'object') {
          // Handle ADF (Atlassian Document Format)
          environment = convertADFToMarkdown(issue.fields.environment);
        }
        // Ensure environment is always a string before concatenation
        if (typeof environment !== 'string') {
          console.error('Environment is not a string:', typeof environment, environment);
          environment = String(environment);
        }
        standardIssueInfo += `\n- Environment: ${environment}`;
      }

      standardIssueInfo += `\n- Creator: ${issue.fields.creator.displayName}`;

      // Add labels if any exist
      if (issue.fields.labels && issue.fields.labels.length > 0) {
        standardIssueInfo += `\n- Labels: ${issue.fields.labels.join(', ')}`;
      }

      // Add Epic link information if available (parent field)
      if (issue.fields.parent) {
        standardIssueInfo += `\n- Epic Link: ${issue.fields.parent.key}`;
      }

      // Add comments if available
      if (issue.fields.comment && issue.fields.comment.comments.length > 0) {
        standardIssueInfo += `\n- Comments: ${issue.fields.comment.comments.length} comment(s)`;

        // Show latest comment
        const latestComment =
          issue.fields.comment.comments[issue.fields.comment.comments.length - 1];
        const commentDate = new Date(latestComment.created).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        // Safely handle comment body (could be string or ADF object)
        let commentBody = '[No content]';
        if (!latestComment.body) {
          commentBody = '[No content]';
        } else if (typeof latestComment.body === 'string') {
          commentBody = latestComment.body;
        } else if (typeof latestComment.body === 'object') {
          // Handle ADF (Atlassian Document Format) - check various possible structures
          const bodyObj = latestComment.body;

          // Use adf-to-md to convert ADF to Markdown
          commentBody = convertADFToMarkdown(bodyObj);
        }

        // Ensure commentBody is always a string before using it
        if (typeof commentBody !== 'string') {
          console.error('Comment body is not a string:', typeof commentBody, commentBody);
          commentBody = String(commentBody);
        }

        const truncatedBody =
          commentBody.length > 100 ? `${commentBody.substring(0, 100)}...` : commentBody;

        standardIssueInfo += `\n- Latest Comment: "${truncatedBody}" by ${latestComment.author?.displayName || 'Unknown'} on ${commentDate}`;
      }

      // Final safeguard to ensure we're returning a string
      const finalText =
        typeof standardIssueInfo === 'string'
          ? standardIssueInfo
          : (console.error(
              'standardIssueInfo is not a string:',
              typeof standardIssueInfo,
              standardIssueInfo
            ),
            String(standardIssueInfo));

      return {
        content: [
          {
            type: 'text',
            text: finalText,
          },
        ],
      };
    },
    session
  );
}
