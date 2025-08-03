/**
 * Handler for the add_comment tool with multi-instance support
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { AddCommentArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export async function handleAddComment(args: AddCommentArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key, comment }, { axiosInstance, instanceConfig }) => {
      // Import ADF converter
      const { safeConvertTextToADF } = await import('../utils/adf-converter.js');

      console.error(`Adding comment to ${issue_key}`);
      console.error(`Instance domain: ${instanceConfig.domain}`);

      try {
        // Method 1: Try API v3 with proper ADF format
        console.error('Attempting API v3 with ADF format...');

        const adfBody = safeConvertTextToADF(comment);
        const v3RequestBody = {
          body: adfBody,
        };

        console.error('ADF Request body:', JSON.stringify(v3RequestBody, null, 2));

        const v3Response = await axiosInstance.post(`/issue/${issue_key}/comment`, v3RequestBody);

        console.error('✅ Comment added successfully via API v3 with ADF');
        return {
          content: [
            {
              type: 'text',
              text: `✅ Comment successfully added to issue ${issue_key} using API v3 with ADF format! Comment ID: ${v3Response.data?.id || 'unknown'}`,
            },
          ],
        };
      } catch (v3Error: any) {
        console.error('❌ API v3 failed:', v3Error.response?.status, v3Error.response?.data);

        // Check for authentication/permission issues that shouldn't fallback
        if (v3Error.response?.status === 401) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Authentication failed: Invalid API token or email for ${instanceConfig.domain}. Please check your credentials in .jira-config.json.`
          );
        }

        if (
          v3Error.response?.status === 404 &&
          v3Error.response?.data?.errorMessages?.includes(
            'Issue does not exist or you do not have permission to see it.'
          )
        ) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Issue ${issue_key} not found or access denied. Check: 1) Issue key is correct, 2) You have permission to view this issue, 3) Your API credentials are valid for ${instanceConfig.domain}.`
          );
        }

        // Method 2: Fallback to API v2 with plain text
        try {
          console.error('Falling back to API v2 with plain text...');

          const v2BaseURL = `https://${instanceConfig.domain}.atlassian.net/rest/api/2`;
          const v2RequestBody = {
            body: comment,
          };

          console.error('V2 Request body:', JSON.stringify(v2RequestBody, null, 2));

          const v2Response = await axiosInstance.request({
            method: 'POST',
            url: `${v2BaseURL}/issue/${issue_key}/comment`,
            data: v2RequestBody,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          });

          console.error('✅ Comment added successfully via API v2 fallback');
          return {
            content: [
              {
                type: 'text',
                text: `✅ Comment successfully added to issue ${issue_key} using API v2 fallback (plain text format)! Comment ID: ${v2Response.data?.id || 'unknown'}`,
              },
            ],
          };
        } catch (v2Error: any) {
          console.error('❌ Both API v3 and v2 failed');
          console.error(
            'V3 Error:',
            v3Error.response?.status,
            JSON.stringify(v3Error.response?.data, null, 2)
          );
          console.error(
            'V2 Error:',
            v2Error.response?.status,
            JSON.stringify(v2Error.response?.data, null, 2)
          );

          // Create detailed error message
          const errorMessage = `Failed to add comment to ${issue_key}. 
API v3 Error: ${v3Error.response?.status} - ${JSON.stringify(v3Error.response?.data)}
API v2 Error: ${v2Error.response?.status} - ${JSON.stringify(v2Error.response?.data)}`;

          throw new McpError(ErrorCode.InternalError, errorMessage);
        }
      }
    },
    session
  );
}
