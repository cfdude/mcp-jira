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

      // Rank will be shown dynamically in the custom fields section below

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

      // Add components if any exist
      if (issue.fields.components && issue.fields.components.length > 0) {
        const componentNames = issue.fields.components.map((c: any) => c.name || c).join(', ');
        standardIssueInfo += `\n- Component/s: ${componentNames}`;
      }

      // Add Epic link information if available (parent field)
      if (issue.fields.parent) {
        standardIssueInfo += `\n- Epic Link: ${issue.fields.parent.key}`;
      }

      // Add time tracking information if available
      if (issue.fields.timetracking && typeof issue.fields.timetracking === 'object') {
        const tt = issue.fields.timetracking;
        if (tt.originalEstimate || tt.remainingEstimate || tt.timeSpent) {
          standardIssueInfo += '\n- Time Tracking:';
          if (tt.originalEstimate) {
            standardIssueInfo += `\n  • Original Estimate: ${tt.originalEstimate}`;
          }
          if (tt.remainingEstimate) {
            standardIssueInfo += `\n  • Remaining Estimate: ${tt.remainingEstimate}`;
          }
          if (tt.timeSpent) {
            standardIssueInfo += `\n  • Time Spent: ${tt.timeSpent}`;
          }
        }
      } else {
        // Fallback to individual time fields if timetracking composite is not available
        // Convert seconds to human-readable format
        const secondsToTimeString = (seconds: number): string => {
          if (!seconds) return '';
          const days = Math.floor(seconds / 28800); // 8 hours per day
          const hours = Math.floor((seconds % 28800) / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);

          const parts = [];
          if (days > 0) parts.push(`${days}d`);
          if (hours > 0) parts.push(`${hours}h`);
          if (minutes > 0) parts.push(`${minutes}m`);

          return parts.join(' ') || '0m';
        };

        const hasTimeFields =
          issue.fields.timeoriginalestimate || issue.fields.timeestimate || issue.fields.timespent;
        if (hasTimeFields) {
          standardIssueInfo += '\n- Time Tracking:';
          if (issue.fields.timeoriginalestimate) {
            const timeStr = secondsToTimeString(issue.fields.timeoriginalestimate);
            standardIssueInfo += `\n  • Original Estimate: ${timeStr}`;
          }
          if (issue.fields.timeestimate) {
            const timeStr = secondsToTimeString(issue.fields.timeestimate);
            standardIssueInfo += `\n  • Remaining Estimate: ${timeStr}`;
          }
          if (issue.fields.timespent) {
            const timeStr = secondsToTimeString(issue.fields.timespent);
            standardIssueInfo += `\n  • Time Spent: ${timeStr}`;
          }
        }
      }

      // Dynamically show ALL custom fields that have values
      try {
        // Get field metadata to map IDs to display names
        const fieldResponse = await axiosInstance.get('/field');
        const fieldMetadata = fieldResponse.data;

        // Create a map of field IDs to display names
        const fieldIdToName = new Map();
        for (const field of fieldMetadata) {
          if (field.id && field.name) {
            fieldIdToName.set(field.id, field.name);
          }
        }

        // Show ALL custom fields that have values (not just hardcoded ones)
        for (const [fieldId, fieldValue] of Object.entries(issue.fields)) {
          // Only show custom fields (start with customfield_) that have values
          if (
            fieldId.startsWith('customfield_') &&
            fieldValue !== undefined &&
            fieldValue !== null &&
            fieldValue !== '' &&
            fieldValue !== 0
          ) {
            // Exclude empty numeric values

            const fieldName = fieldIdToName.get(fieldId) || fieldId;

            // Skip fields we already show elsewhere (Story Points, Sprint, etc.)
            if (
              fieldName.toLowerCase().includes('story point') &&
              fieldName !== 'Story point estimate'
            ) {
              continue; // Skip Story Points as we show it via formatStoryPoints
            }
            if (fieldName.toLowerCase().includes('sprint')) {
              continue; // Skip Sprint as we show it via formatSprintInfo
            }
            if (fieldName.toLowerCase().includes('rank')) {
              continue; // Skip Rank as we show it separately
            }

            // Format the field value appropriately
            let displayValue = fieldValue;

            // Handle different field value types
            if (typeof fieldValue === 'object' && fieldValue !== null) {
              if ('name' in fieldValue && fieldValue.name) {
                displayValue = fieldValue.name; // Option fields
              } else if ('displayName' in fieldValue && fieldValue.displayName) {
                displayValue = fieldValue.displayName; // User fields
              } else if (Array.isArray(fieldValue)) {
                displayValue = fieldValue
                  .map(v =>
                    typeof v === 'object' && v !== null
                      ? ('name' in v && v.name) || ('displayName' in v && v.displayName) || v
                      : v
                  )
                  .join(', ');
              } else {
                displayValue = JSON.stringify(fieldValue);
              }
            } else if (
              typeof fieldValue === 'string' &&
              fieldValue.match(/^\\d{4}-\\d{2}-\\d{2}/)
            ) {
              // Format dates
              displayValue = new Date(fieldValue).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
            }

            standardIssueInfo += `\n- ${fieldName}: ${displayValue}`;
          }
        }
      } catch (error) {
        console.error('Error fetching field metadata for dynamic display:', error);
        // If we can't get field metadata, just show the field IDs with values
        for (const [fieldId, fieldValue] of Object.entries(issue.fields)) {
          if (
            fieldId.startsWith('customfield_') &&
            fieldValue !== undefined &&
            fieldValue !== null &&
            fieldValue !== '' &&
            fieldValue !== 0
          ) {
            standardIssueInfo += `\n- ${fieldId}: ${fieldValue}`;
          }
        }
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
