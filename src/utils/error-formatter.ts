/**
 * Enhanced error formatting utilities for better user experience
 */

export interface JiraErrorDetails {
  status?: number;
  statusText?: string;
  errorMessages?: string[];
  fieldErrors?: Record<string, string>;
  rawError?: any;
}

export interface FormattedError {
  title: string;
  description: string;
  troubleshooting?: string[];
  fieldIssues?: string[];
}

/**
 * Extract detailed error information from Jira API responses
 */
export function extractJiraErrorDetails(error: any): JiraErrorDetails {
  const details: JiraErrorDetails = {
    rawError: error,
  };

  if (error.response) {
    details.status = error.response.status;
    details.statusText = error.response.statusText;

    if (error.response.data) {
      const data = error.response.data;
      details.errorMessages = data.errorMessages || [];
      details.fieldErrors = data.errors || {};
    }
  }

  return details;
}

/**
 * Format error details into user-friendly messages
 */
export function formatJiraError(error: any, context: string = 'operation'): FormattedError {
  const details = extractJiraErrorDetails(error);

  switch (details.status) {
    case 400:
      return format400Error(details, context);
    case 401:
      return format401Error(details, context);
    case 403:
      return format403Error(details, context);
    case 404:
      return format404Error(details, context);
    case 409:
      return format409Error(details, context);
    default:
      return formatGenericError(details, context);
  }
}

function format400Error(details: JiraErrorDetails, context: string): FormattedError {
  const fieldIssues: string[] = [];
  const troubleshooting: string[] = [];

  // Process field-specific errors
  if (details.fieldErrors && Object.keys(details.fieldErrors).length > 0) {
    Object.entries(details.fieldErrors).forEach(([field, message]) => {
      // Provide user-friendly field names
      const friendlyFieldName = getFriendlyFieldName(field);
      if (friendlyFieldName && message) {
        fieldIssues.push(`**${friendlyFieldName}:** ${message}`);
      }

      // Add field-specific troubleshooting
      const fieldTroubleshooting = getFieldTroubleshooting(field, message);
      troubleshooting.push(...fieldTroubleshooting);
    });
  }

  // Add general error messages
  if (details.errorMessages && details.errorMessages.length > 0) {
    details.errorMessages.forEach(msg => {
      if (!fieldIssues.some(fi => fi.includes(msg))) {
        fieldIssues.push(`**General:** ${msg}`);
      }
    });
  }

  return {
    title: `Invalid Request: ${context} failed`,
    description: 'The request contains invalid data or violates Jira field requirements.',
    fieldIssues: fieldIssues.length > 0 ? fieldIssues : undefined,
    troubleshooting:
      troubleshooting.length > 0
        ? troubleshooting
        : [
            'Verify all required fields are provided',
            'Check field value formats and constraints',
            'Ensure issue type supports the specified fields',
            'Validate that referenced items (users, sprints, etc.) exist',
          ],
  };
}

function format401Error(details: JiraErrorDetails, context: string): FormattedError {
  return {
    title: `Authentication Failed: ${context} denied`,
    description: 'Your credentials are invalid or expired.',
    troubleshooting: [
      'Verify your API token is correct and not expired',
      'Check that your email address matches your Jira account',
      'Ensure your Jira domain is correctly configured',
      'Try regenerating your API token from Atlassian Account Settings',
    ],
  };
}

function format403Error(details: JiraErrorDetails, context: string): FormattedError {
  return {
    title: `Permission Denied: ${context} not allowed`,
    description: "You don't have sufficient permissions to perform this action.",
    troubleshooting: [
      'Verify you have the required project permissions',
      'Check your role in the project (Developer, Admin, etc.)',
      'Ensure the feature is enabled in your Jira instance',
      'Contact your Jira administrator for permission assistance',
      'Confirm the project/issue exists and is accessible to you',
    ],
  };
}

function format404Error(details: JiraErrorDetails, context: string): FormattedError {
  const troubleshooting = ['Verify the resource exists and is accessible'];

  // Add context-specific troubleshooting
  if (context.includes('issue')) {
    troubleshooting.push(
      'Check the issue key format (e.g., PROJ-123)',
      "Ensure the issue hasn't been deleted or moved",
      'Verify you have permission to view the issue'
    );
  } else if (context.includes('project')) {
    troubleshooting.push(
      'Check the project key is correct',
      'Ensure the project exists and is accessible',
      'Verify project permissions'
    );
  } else if (context.includes('epic')) {
    troubleshooting.push(
      'Verify the epic key format and existence',
      'Check if Epic issue type is enabled in the project'
    );
  }

  return {
    title: `Resource Not Found: ${context} not found`,
    description: 'The requested resource could not be found or is not accessible.',
    troubleshooting,
  };
}

function format409Error(details: JiraErrorDetails, context: string): FormattedError {
  return {
    title: `Conflict: ${context} conflict detected`,
    description: 'The operation conflicts with the current state of the resource.',
    troubleshooting: [
      'Check if another user is modifying the same resource',
      "Verify the resource hasn't been changed since you last accessed it",
      'Refresh the resource state and try again',
      "Ensure you're working with the latest version",
    ],
  };
}

function formatGenericError(details: JiraErrorDetails, context: string): FormattedError {
  return {
    title: `Error: ${context} failed`,
    description: details.rawError?.message || 'An unexpected error occurred.',
    troubleshooting: [
      'Check your internet connection',
      'Verify Jira server is accessible',
      'Try the operation again after a short wait',
      'Contact support if the issue persists',
    ],
  };
}

/**
 * Convert technical field names to user-friendly names
 */
function getFriendlyFieldName(fieldId: string): string {
  const fieldMap: Record<string, string> = {
    summary: 'Summary',
    description: 'Description',
    issuetype: 'Issue Type',
    priority: 'Priority',
    assignee: 'Assignee',
    reporter: 'Reporter',
    labels: 'Labels',
    project: 'Project',
    customfield_10011: 'Epic Name',
    customfield_10014: 'Epic Link',
    customfield_10016: 'Story Points',
    customfield_10020: 'Sprint',
    parent: 'Parent Issue',
    components: 'Components',
    fixVersions: 'Fix Versions',
    versions: 'Affects Versions',
  };

  return fieldMap[fieldId] || fieldId;
}

/**
 * Provide field-specific troubleshooting advice
 */
function getFieldTroubleshooting(fieldId: string, errorMessage: string): string[] {
  const troubleshooting: string[] = [];

  switch (fieldId) {
    case 'summary':
      if (errorMessage.includes('required')) {
        troubleshooting.push('Summary is required - provide a brief title for the issue');
      }
      if (errorMessage.includes('too long')) {
        troubleshooting.push('Summary is too long - keep it under 255 characters');
      }
      break;

    case 'issuetype':
      troubleshooting.push('Check available issue types with `get_issue_types`');
      troubleshooting.push('Ensure the issue type is enabled for this project');
      break;

    case 'assignee':
      troubleshooting.push('Verify the user exists and has access to the project');
      troubleshooting.push('Use display name, email address, or account ID');
      troubleshooting.push('Use "unassigned" to leave the issue unassigned');
      break;

    case 'customfield_10011': // Epic Name
      troubleshooting.push('Epic Name field may not be available in this project');
      troubleshooting.push('Try creating the epic without the Epic Name field');
      break;

    case 'customfield_10016': // Story Points
      troubleshooting.push('Story Points field may not be enabled for this issue type');
      troubleshooting.push('Use a numeric value (e.g., 1, 2, 3, 5, 8)');
      break;

    case 'customfield_10020': // Sprint
      troubleshooting.push('Verify the sprint exists and is active');
      troubleshooting.push('Use sprint name or "current" for active sprint');
      break;

    case 'priority':
      troubleshooting.push('Check available priorities for this project');
      troubleshooting.push('Common values: Highest, High, Medium, Low, Lowest');
      break;

    case 'project':
      troubleshooting.push('Verify the project key exists and is accessible');
      troubleshooting.push('Check project permissions');
      break;
  }

  return troubleshooting;
}

/**
 * Format error as markdown text for MCP response
 */
export function formatErrorAsMarkdown(formattedError: FormattedError): string {
  let markdown = `# ${formattedError.title}\n\n`;
  markdown += `${formattedError.description}\n\n`;

  if (formattedError.fieldIssues && formattedError.fieldIssues.length > 0) {
    markdown += `## Field Issues\n`;
    formattedError.fieldIssues.forEach(issue => {
      markdown += `- ${issue}\n`;
    });
    markdown += `\n`;
  }

  if (formattedError.troubleshooting && formattedError.troubleshooting.length > 0) {
    markdown += `## Troubleshooting Steps\n`;
    formattedError.troubleshooting.forEach((step, index) => {
      markdown += `${index + 1}. ${step}\n`;
    });
    markdown += `\n`;
  }

  return markdown;
}
