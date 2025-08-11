/**
 * Text field handling utilities for Jira API v3/v2 compatibility
 * Provides fallback mechanisms for long text content
 */
import { AxiosInstance } from 'axios';
import { safeConvertTextToADF } from './adf-converter.js';
import { JiraInstanceConfig } from '../types.js';

export interface TextUpdateResult {
  success: boolean;
  method: 'v3-adf' | 'v2-text' | 'failed';
  error?: string;
}

/**
 * Update issue description with proper ADF handling and API fallback
 */
export async function updateIssueDescription(
  axiosInstance: AxiosInstance,
  instanceConfig: JiraInstanceConfig,
  issueKey: string,
  description: string
): Promise<TextUpdateResult> {
  console.error(`Updating description for ${issueKey}, length: ${description.length}`);

  // Method 1: Try API v3 with ADF format
  try {
    console.error('Attempting API v3 with ADF format for description...');

    const adfDescription = safeConvertTextToADF(description);
    const v3UpdateData = {
      fields: {
        description: adfDescription,
      },
    };

    await axiosInstance.put(`/issue/${issueKey}`, v3UpdateData);

    console.error('✅ Description updated successfully via API v3 with ADF');
    return { success: true, method: 'v3-adf' };
  } catch (v3Error: any) {
    console.error('❌ API v3 ADF description update failed:', v3Error.response?.status);

    // Method 2: Try API v2 with plain text
    try {
      console.error('Falling back to API v2 with plain text for description...');

      const v2BaseURL = `https://${instanceConfig.domain}.atlassian.net/rest/api/2`;
      const v2UpdateData = {
        fields: {
          description: description,
        },
      };

      await axiosInstance.request({
        method: 'PUT',
        url: `${v2BaseURL}/issue/${issueKey}`,
        data: v2UpdateData,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.error('✅ Description updated successfully via API v2 fallback');
      return { success: true, method: 'v2-text' };
    } catch (v2Error: any) {
      console.error('❌ Both API v3 and v2 description updates failed');
      const errorMsg = `V3: ${v3Error.response?.status} ${JSON.stringify(v3Error.response?.data)} | V2: ${v2Error.response?.status} ${JSON.stringify(v2Error.response?.data)}`;
      return { success: false, method: 'failed', error: errorMsg };
    }
  }
}

/**
 * Add comment with proper ADF handling and API fallback
 */
export async function addIssueComment(
  axiosInstance: AxiosInstance,
  instanceConfig: JiraInstanceConfig,
  issueKey: string,
  comment: string
): Promise<TextUpdateResult> {
  console.error(`Adding comment to ${issueKey}, length: ${comment.length}`);

  // Method 1: Try API v3 with ADF format
  try {
    console.error('Attempting API v3 with ADF format for comment...');

    const adfComment = safeConvertTextToADF(comment);
    const v3RequestBody = {
      body: adfComment,
    };

    await axiosInstance.post(`/issue/${issueKey}/comment`, v3RequestBody);

    console.error('✅ Comment added successfully via API v3 with ADF');
    return { success: true, method: 'v3-adf' };
  } catch (v3Error: any) {
    console.error('❌ API v3 ADF comment failed:', v3Error.response?.status);

    // Method 2: Try API v2 with plain text
    try {
      console.error('Falling back to API v2 with plain text for comment...');

      const v2BaseURL = `https://${instanceConfig.domain}.atlassian.net/rest/api/2`;
      const v2RequestBody = {
        body: comment,
      };

      await axiosInstance.request({
        method: 'POST',
        url: `${v2BaseURL}/issue/${issueKey}/comment`,
        data: v2RequestBody,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.error('✅ Comment added successfully via API v2 fallback');
      return { success: true, method: 'v2-text' };
    } catch (v2Error: any) {
      console.error('❌ Both API v3 and v2 comment operations failed');
      const errorMsg = `V3: ${v3Error.response?.status} ${JSON.stringify(v3Error.response?.data)} | V2: ${v2Error.response?.status} ${JSON.stringify(v2Error.response?.data)}`;
      return { success: false, method: 'failed', error: errorMsg };
    }
  }
}

/**
 * Handle mixed field updates - some fields work with v3, text fields may need v2 fallback
 */
export async function updateIssueWithTextFallback(
  axiosInstance: AxiosInstance,
  instanceConfig: JiraInstanceConfig,
  issueKey: string,
  updateData: any
): Promise<TextUpdateResult> {
  // First, try the complete update with v3
  try {
    console.error('Attempting complete issue update via API v3...');

    // Convert description to ADF if present
    if (updateData.fields.description) {
      updateData.fields.description = safeConvertTextToADF(updateData.fields.description);
    }

    await axiosInstance.put(`/issue/${issueKey}`, updateData);

    console.error('✅ Issue updated successfully via API v3');
    return { success: true, method: 'v3-adf' };
  } catch (v3Error: any) {
    console.error(
      '❌ API v3 complete update failed:',
      v3Error.response?.status || 'Unknown status'
    );

    // Check if the error is the "Cannot read properties" error
    if (v3Error.message && v3Error.message.includes('Cannot read properties')) {
      console.error('JavaScript error detected:', v3Error.message);
      console.error('Stack trace:', v3Error.stack);
      throw v3Error; // Re-throw to see where it's coming from
    }

    console.error('V3 Error details:', {
      message: v3Error.message,
      data: v3Error.response?.data,
    });

    // Extract text fields and non-text fields
    const textFields: any = {};
    const nonTextFields: any = {};

    Object.entries(updateData.fields).forEach(([key, value]) => {
      if (key === 'description' && typeof value === 'string') {
        textFields[key] = value;
      } else {
        nonTextFields[key] = value;
      }
    });

    // Try updating non-text fields with v3, then text fields with v2
    let success = true;
    let methods: string[] = [];

    // Update non-text fields with v3 if any
    if (Object.keys(nonTextFields).length > 0) {
      try {
        await axiosInstance.put(`/issue/${issueKey}`, { fields: nonTextFields });
        methods.push('v3-fields');
        console.error('✅ Non-text fields updated via API v3');
      } catch (error: any) {
        console.error('❌ Non-text fields update failed:', error.message || error);
        console.error('Error response:', error.response?.data);
        success = false;
      }
    }

    // Update text fields with v2 if any
    if (Object.keys(textFields).length > 0) {
      try {
        const v2BaseURL = `https://${instanceConfig.domain}.atlassian.net/rest/api/2`;
        await axiosInstance.request({
          method: 'PUT',
          url: `${v2BaseURL}/issue/${issueKey}`,
          data: { fields: textFields },
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });
        methods.push('v2-text');
        console.error('✅ Text fields updated via API v2');
      } catch (error: any) {
        console.error('❌ Text fields update failed:', error.message || error);
        success = false;
      }
    }

    if (success) {
      return { success: true, method: methods.join('+') as any };
    } else {
      let errorDetails = '';
      try {
        errorDetails = JSON.stringify(v3Error.response?.data);
      } catch (e) {
        errorDetails = 'Unable to stringify error data';
      }
      const errorMsg = `Mixed update failed. V3 error: ${v3Error.response?.status} ${errorDetails}`;
      return { success: false, method: 'failed', error: errorMsg };
    }
  }
}

/**
 * Create issue with proper text handling
 */
export async function createIssueWithTextHandling(
  axiosInstance: AxiosInstance,
  instanceConfig: JiraInstanceConfig,
  createData: any
): Promise<{ success: boolean; method: string; issueKey?: string; error?: string }> {
  // Try API v3 with ADF format first
  try {
    console.error('Attempting issue creation via API v3 with ADF...');

    // Convert description to ADF if present
    if (createData.fields.description) {
      createData.fields.description = safeConvertTextToADF(createData.fields.description);
    }

    const response = await axiosInstance.post('/issue', createData);

    console.error('✅ Issue created successfully via API v3');
    return {
      success: true,
      method: 'v3-adf',
      issueKey: response.data.key,
    };
  } catch (v3Error: any) {
    console.error('❌ API v3 issue creation failed:', v3Error.response?.status);

    // Try API v2 with plain text
    try {
      console.error('Falling back to API v2 for issue creation...');

      const v2BaseURL = `https://${instanceConfig.domain}.atlassian.net/rest/api/2`;

      // Reset description to plain text if it was converted
      const v2CreateData = { ...createData };
      if (v2CreateData.fields.description && typeof v2CreateData.fields.description === 'object') {
        // Extract text from ADF if possible, or use original
        v2CreateData.fields.description =
          extractTextFromADF(v2CreateData.fields.description) || 'Description content';
      }

      const response = await axiosInstance.request({
        method: 'POST',
        url: `${v2BaseURL}/issue`,
        data: v2CreateData,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.error('✅ Issue created successfully via API v2 fallback');
      return {
        success: true,
        method: 'v2-text',
        issueKey: response.data.key,
      };
    } catch (v2Error: any) {
      console.error('❌ Both API v3 and v2 issue creation failed');
      const errorMsg = `V3: ${v3Error.response?.status} ${JSON.stringify(v3Error.response?.data)} | V2: ${v2Error.response?.status} ${JSON.stringify(v2Error.response?.data)}`;
      return { success: false, method: 'failed', error: errorMsg };
    }
  }
}

/**
 * Extract plain text from ADF document (simple implementation)
 */
function extractTextFromADF(adf: any): string {
  if (!adf || !adf.content) return '';

  let text = '';

  function extractFromContent(content: any[]): void {
    content.forEach(node => {
      if (node.type === 'text' && node.text) {
        text += node.text;
      } else if (node.content) {
        extractFromContent(node.content);
      }

      // Add line breaks for paragraphs
      if (node.type === 'paragraph') {
        text += '\n';
      }
    });
  }

  extractFromContent(adf.content);
  return text.trim();
}
