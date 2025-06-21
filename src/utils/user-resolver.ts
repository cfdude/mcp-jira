/**
 * Utility functions for resolving user names to Jira account IDs
 */
import { AxiosInstance } from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

/**
 * Resolves a user identifier (display name, email, or account ID) to a Jira account ID
 * 
 * @param axiosInstance - Jira API instance
 * @param userIdentifier - User display name (e.g., "Esther Yang"), email, or account ID
 * @returns Promise<string> - The account ID for the user
 * @throws McpError if user cannot be found or resolved
 */
export async function resolveUserToAccountId(
  axiosInstance: AxiosInstance,
  userIdentifier: string
): Promise<string> {
  // Handle special cases
  if (userIdentifier.toLowerCase() === 'unassigned' || userIdentifier.toLowerCase() === 'none') {
    throw new McpError(ErrorCode.InvalidRequest, 'Use null or empty string to unassign, not "unassigned"');
  }

  // If it looks like an account ID already (starts with specific patterns), return as-is
  if (userIdentifier.startsWith('5') && userIdentifier.length > 20) {
    return userIdentifier;
  }

  try {
    // Search for users using the Jira user search API
    console.error(`Searching for user: "${userIdentifier}"`);
    
    // Try searching by display name first
    const searchResponse = await axiosInstance.get('/user/search', {
      params: {
        query: userIdentifier,
        maxResults: 50
      }
    });

    const users: JiraUser[] = searchResponse.data;
    console.error(`Found ${users.length} users matching "${userIdentifier}"`);

    if (users.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest, 
        `No users found matching "${userIdentifier}". Please check the spelling or try using their email address.`
      );
    }

    // Look for exact display name match first
    let exactMatch = users.find(user => 
      user.displayName.toLowerCase() === userIdentifier.toLowerCase()
    );

    if (exactMatch) {
      console.error(`Found exact display name match: ${exactMatch.displayName} (${exactMatch.accountId})`);
      return exactMatch.accountId;
    }

    // Look for email match
    exactMatch = users.find(user => 
      user.emailAddress?.toLowerCase() === userIdentifier.toLowerCase()
    );

    if (exactMatch) {
      console.error(`Found email match: ${exactMatch.emailAddress} -> ${exactMatch.displayName} (${exactMatch.accountId})`);
      return exactMatch.accountId;
    }

    // Look for partial display name match
    const partialMatches = users.filter(user =>
      user.displayName.toLowerCase().includes(userIdentifier.toLowerCase()) ||
      userIdentifier.toLowerCase().includes(user.displayName.toLowerCase())
    );

    if (partialMatches.length === 1) {
      const match = partialMatches[0];
      console.error(`Found partial display name match: ${match.displayName} (${match.accountId})`);
      return match.accountId;
    }

    if (partialMatches.length > 1) {
      const matchNames = partialMatches.map(u => `"${u.displayName}"`).join(', ');
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Multiple users found matching "${userIdentifier}": ${matchNames}. Please be more specific.`
      );
    }

    // If we get here, we found users but no good matches
    const availableNames = users
      .filter(u => u.active)
      .slice(0, 10) // Limit to first 10 to avoid huge error messages
      .map(u => `"${u.displayName}"`)
      .join(', ');
    
    throw new McpError(
      ErrorCode.InvalidRequest,
      `No exact match found for "${userIdentifier}". Similar users: ${availableNames}${users.length > 10 ? '...' : ''}`
    );

  } catch (error: any) {
    if (error instanceof McpError) {
      throw error;
    }
    
    console.error('Error searching for user:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search for user "${userIdentifier}": ${error.message}`
    );
  }
}

/**
 * Gets user information by account ID
 * 
 * @param axiosInstance - Jira API instance  
 * @param accountId - The account ID to look up
 * @returns Promise<JiraUser> - User information
 */
export async function getUserByAccountId(
  axiosInstance: AxiosInstance,
  accountId: string
): Promise<JiraUser> {
  try {
    const response = await axiosInstance.get(`/user`, {
      params: { accountId }
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching user ${accountId}:`, error);
    throw new McpError(
      ErrorCode.InvalidRequest,
      `User with account ID "${accountId}" not found`
    );
  }
}

/**
 * Validates and resolves an assignee value for Jira issue updates
 * 
 * @param axiosInstance - Jira API instance
 * @param assigneeValue - Can be null/undefined (unassign), "unassigned" (unassign), display name, email, or account ID
 * @returns Promise<string | null> - Account ID or null for unassigned
 */
export async function resolveAssigneeValue(
  axiosInstance: AxiosInstance,
  assigneeValue: string | null | undefined
): Promise<string | null> {
  // Handle unassignment cases
  if (!assigneeValue || 
      assigneeValue.toLowerCase() === 'unassigned' || 
      assigneeValue.toLowerCase() === 'none' ||
      assigneeValue.trim() === '') {
    return null;
  }

  // Resolve to account ID
  return await resolveUserToAccountId(axiosInstance, assigneeValue);
}