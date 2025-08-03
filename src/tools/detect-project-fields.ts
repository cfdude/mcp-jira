import { z } from 'zod';
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

const DetectProjectFieldsSchema = z.object({
  working_dir: z.string().describe('Working directory containing .jira-config.json'),
  projectKey: z.string().describe('Project key to detect fields for (e.g., "PROJ", "APP")'),
  instance: z
    .string()
    .optional()
    .describe(
      'Optional instance name to override automatic instance selection (e.g., "highway", "onvex")'
    ),
});

interface JiraField {
  id: string;
  name: string;
  custom: boolean;
  schema?: {
    type: string;
    system?: string;
  };
}

interface DetectedFields {
  storyPoints?: {
    id: string;
    name: string;
  };
  sprint?: {
    id: string;
    name: string;
  };
  epicLink?: {
    id: string;
    name: string;
  };
}

/**
 * Detects project-specific custom field IDs for story points, sprint, and epic link
 * Provides ready-to-copy configuration snippets for .jira-config.json
 */
export async function detectProjectFields(
  args: z.infer<typeof DetectProjectFieldsSchema>,
  sessionState?: SessionState
): Promise<string> {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { axiosInstance, instanceConfig, projectKey }) => {
      console.error('[detect-project-fields] Starting field detection', {
        projectKey,
        instance: args.instance,
        workingDir: args.working_dir,
      });

      // Fetch all fields
      console.error('[detect-project-fields] Fetching field metadata from Jira API');
      const response = await axiosInstance.get('/field');
      const fields: JiraField[] = response.data;

      console.error('[detect-project-fields] Retrieved', fields.length, 'fields');

      // Detect fields using heuristics
      const detectedFields: DetectedFields = {};

      // Find story points field (custom number field with name containing story/point/estimate)
      const storyPointsField = fields.find(
        field =>
          field.custom &&
          field.schema?.type === 'number' &&
          /story|point|estimate/i.test(field.name)
      );

      if (storyPointsField) {
        detectedFields.storyPoints = {
          id: storyPointsField.id,
          name: storyPointsField.name,
        };
        console.error(
          '[detect-project-fields] Found story points field:',
          storyPointsField.name,
          storyPointsField.id
        );
      }

      // Find sprint field (Greenhopper sprint field)
      const sprintField = fields.find(
        field =>
          field.id === 'com.pyxis.greenhopper.jira:gh-sprint' ||
          field.schema?.system === 'com.pyxis.greenhopper.jira:gh-sprint'
      );

      if (sprintField) {
        detectedFields.sprint = {
          id: sprintField.id,
          name: sprintField.name,
        };
        console.error(
          '[detect-project-fields] Found sprint field:',
          sprintField.name,
          sprintField.id
        );
      }

      // Find epic link field (Greenhopper epic link field)
      const epicLinkField = fields.find(
        field =>
          field.id === 'com.pyxis.greenhopper.jira:gh-epic-link' ||
          field.schema?.system === 'com.pyxis.greenhopper.jira:gh-epic-link'
      );

      if (epicLinkField) {
        detectedFields.epicLink = {
          id: epicLinkField.id,
          name: epicLinkField.name,
        };
        console.error(
          '[detect-project-fields] Found epic link field:',
          epicLinkField.name,
          epicLinkField.id
        );
      }

      // Get instance name for configuration snippet
      const instanceName = args.instance || 'default';

      // Generate configuration snippet
      let configSnippet = `Configuration snippet for project "${projectKey}" in instance "${instanceName}":\n\n`;

      if (Object.keys(detectedFields).length === 0) {
        configSnippet += `⚠️  No custom fields detected for project ${projectKey}.\n`;
        configSnippet += `This might indicate:\n`;
        configSnippet += `- The project doesn't use story points, sprints, or epics\n`;
        configSnippet += `- You don't have permission to view field metadata\n`;
        configSnippet += `- The fields use non-standard naming conventions\n\n`;
        configSnippet += `To manually check field IDs, visit:\n`;
        configSnippet += `https://${instanceConfig.domain}.atlassian.net/secure/admin/ViewCustomFields.jspa\n`;
      } else {
        configSnippet += `✅ Detected fields for project ${projectKey}:\n\n`;

        if (detectedFields.storyPoints) {
          configSnippet += `Story Points: ${detectedFields.storyPoints.name} (${detectedFields.storyPoints.id})\n`;
        }
        if (detectedFields.sprint) {
          configSnippet += `Sprint: ${detectedFields.sprint.name} (${detectedFields.sprint.id})\n`;
        }
        if (detectedFields.epicLink) {
          configSnippet += `Epic Link: ${detectedFields.epicLink.name} (${detectedFields.epicLink.id})\n`;
        }

        configSnippet += `\n📋 Copy this configuration to your .jira-config.json:\n\n`;
        configSnippet += `Add this to the "${instanceName}" instance configuration under "projects":\n\n`;
        configSnippet += `"${projectKey}": {\n`;

        if (detectedFields.storyPoints) {
          configSnippet += `  "storyPointsField": "${detectedFields.storyPoints.id}",\n`;
        }
        if (detectedFields.sprint) {
          configSnippet += `  "sprintField": "${detectedFields.sprint.id}",\n`;
        }
        if (detectedFields.epicLink) {
          configSnippet += `  "epicLinkField": "${detectedFields.epicLink.id}"\n`;
        }

        configSnippet += `}\n\n`;
        configSnippet += `Example full configuration structure:\n\n`;
        configSnippet += `{\n`;
        configSnippet += `  "instances": {\n`;
        configSnippet += `    "${instanceName}": {\n`;
        configSnippet += `      "domain": "${instanceConfig.domain}",\n`;
        configSnippet += `      "email": "${instanceConfig.email}",\n`;
        configSnippet += `      "apiToken": "your-api-token",\n`;
        configSnippet += `      "projects": {\n`;
        configSnippet += `        "${projectKey}": {\n`;

        if (detectedFields.storyPoints) {
          configSnippet += `          "storyPointsField": "${detectedFields.storyPoints.id}",\n`;
        }
        if (detectedFields.sprint) {
          configSnippet += `          "sprintField": "${detectedFields.sprint.id}",\n`;
        }
        if (detectedFields.epicLink) {
          configSnippet += `          "epicLinkField": "${detectedFields.epicLink.id}"\n`;
        }

        configSnippet += `        }\n`;
        configSnippet += `      }\n`;
        configSnippet += `    }\n`;
        configSnippet += `  },\n`;
        configSnippet += `  "projects": {\n`;
        configSnippet += `    "${projectKey}": {\n`;
        configSnippet += `      "instance": "${instanceName}",\n`;

        if (detectedFields.storyPoints) {
          configSnippet += `      "storyPointsField": "${detectedFields.storyPoints.id}",\n`;
        }
        if (detectedFields.sprint) {
          configSnippet += `      "sprintField": "${detectedFields.sprint.id}",\n`;
        }
        if (detectedFields.epicLink) {
          configSnippet += `      "epicLinkField": "${detectedFields.epicLink.id}"\n`;
        }

        configSnippet += `    }\n`;
        configSnippet += `  }\n`;
        configSnippet += `}\n`;
      }

      console.error('[detect-project-fields] Field detection completed successfully');
      return configSnippet;
    },
    sessionState
  );
}

export const detectProjectFieldsTool = {
  name: 'detect_project_fields',
  description:
    'Detect custom field IDs (story points, sprint, epic link) for a specific project and instance. Provides ready-to-copy configuration snippets for .jira-config.json setup.',
  inputSchema: DetectProjectFieldsSchema,
  handler: detectProjectFields,
};
