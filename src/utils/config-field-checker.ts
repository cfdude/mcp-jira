/**
 * Utility functions for checking field configuration completeness
 * and providing user guidance for missing configurations
 */
import { sessionManager } from '../session-manager.js';
import type { MultiInstanceJiraConfig } from '../types.js';

export interface MissingFieldsInfo {
  hasMissingFields: boolean;
  missingFields: string[];
  guidance: string;
}

/**
 * Check if required fields are configured for a project instance
 */
export function checkRequiredFields(
  config: MultiInstanceJiraConfig,
  instanceName: string,
  projectKey: string
): MissingFieldsInfo {
  const instance = config.instances[instanceName];
  if (!instance) {
    return {
      hasMissingFields: true,
      missingFields: ['instance'],
      guidance: `Instance "${instanceName}" not found in configuration.`,
    };
  }

  const projectConfig = config.projects?.[projectKey];
  const missingFields: string[] = [];

  // Check for story points field
  if (!projectConfig?.storyPointsField) {
    missingFields.push('storyPointsField');
  }

  // Check for sprint field
  if (!projectConfig?.sprintField) {
    missingFields.push('sprintField');
  }

  // Check for epic link field
  if (!projectConfig?.epicLinkField) {
    missingFields.push('epicLinkField');
  }

  if (missingFields.length === 0) {
    return {
      hasMissingFields: false,
      missingFields: [],
      guidance: '',
    };
  }

  const guidance = generateFieldConfigGuidance(instanceName, projectKey, missingFields);

  return {
    hasMissingFields: true,
    missingFields,
    guidance,
  };
}

/**
 * Generate user-friendly guidance for missing field configuration
 */
function generateFieldConfigGuidance(
  instanceName: string,
  projectKey: string,
  missingFields: string[]
): string {
  let guidance = `⚠️  Missing field configuration for project "${projectKey}" in instance "${instanceName}":\n\n`;

  guidance += `Missing fields: ${missingFields.join(', ')}\n\n`;

  guidance += `To fix this, you have two options:\n\n`;

  guidance += `🔧 **Option 1: Auto-detect fields**\n`;
  guidance += `Run the detect_project_fields tool to automatically discover field IDs:\n`;
  guidance += `\`\`\`\n`;
  guidance += `detect_project_fields({\n`;
  guidance += `  working_dir: "/path/to/your/project",\n`;
  guidance += `  instance: "${instanceName}",\n`;
  guidance += `  projectKey: "${projectKey}"\n`;
  guidance += `})\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `📝 **Option 2: Manual configuration**\n`;
  guidance += `Add the missing fields to your .jira-config.json under instance "${instanceName}":\n`;
  guidance += `\`\`\`json\n`;
  guidance += `{\n`;
  guidance += `  "instances": {\n`;
  guidance += `    "${instanceName}": {\n`;
  guidance += `      "projects": {\n`;
  guidance += `        "${projectKey}": {\n`;

  if (missingFields.includes('storyPointsField')) {
    guidance += `          "storyPointsField": "customfield_XXXXX",\n`;
  }
  if (missingFields.includes('sprintField')) {
    guidance += `          "sprintField": "customfield_XXXXX",\n`;
  }
  if (missingFields.includes('epicLinkField')) {
    guidance += `          "epicLinkField": "customfield_XXXXX"\n`;
  }

  guidance += `        }\n`;
  guidance += `      }\n`;
  guidance += `    }\n`;
  guidance += `  }\n`;
  guidance += `}\n`;
  guidance += `\`\`\`\n\n`;

  guidance += `💡 **Impact of missing fields:**\n`;
  if (missingFields.includes('storyPointsField')) {
    guidance += `- Story points operations will not work\n`;
  }
  if (missingFields.includes('sprintField')) {
    guidance += `- Sprint-related operations may fail\n`;
  }
  if (missingFields.includes('epicLinkField')) {
    guidance += `- Epic linking operations will not work\n`;
  }

  return guidance;
}

/**
 * Check project access and provide configuration guidance if needed
 * This is the main function to be called by tools
 */
export function checkProjectConfigAndProvideGuidance(
  sessionId: string,
  config: MultiInstanceJiraConfig,
  instanceName: string,
  projectKey: string
): string | null {
  // Track project access - returns true if this is first access
  const isFirstAccess = sessionManager.trackProjectAccess(sessionId, instanceName, projectKey);

  // Only check and provide guidance on first access
  if (!isFirstAccess) {
    return null;
  }

  // Check if required fields are configured
  const fieldCheck = checkRequiredFields(config, instanceName, projectKey);

  if (fieldCheck.hasMissingFields) {
    return fieldCheck.guidance;
  }

  return null;
}
