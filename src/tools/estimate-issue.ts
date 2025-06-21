/**
 * Handler for the estimate_issue tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

interface EstimateIssueArgs {
  working_dir: string;
  issueKey: string;
  value: string;
}

export async function handleEstimateIssue(
  agileAxiosInstance: AxiosInstance,
  args: EstimateIssueArgs
) {
  const { issueKey, value } = args;
  
  console.error("Setting issue estimation:", {
    issueKey,
    value
  });

  try {
    const response = await agileAxiosInstance.put(`/issue/${issueKey}/estimation`, {
      value: value
    });
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Issue estimation updated successfully!

📊 **Estimation Details:**
- **Issue:** ${issueKey}
- **Estimation Value:** ${value}

The issue estimation has been updated. This affects planning calculations and reports.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error setting issue estimation:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Issue ${issueKey} not found`
      );
    }
    
    if (error.response?.status === 400) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid estimation value: ${error.response?.data?.message || 'Check the estimation format'}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to set issue estimation: ${error.response?.data?.message || error.message}`
    );
  }
}