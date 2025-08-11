/**
 * Tool to list all available custom fields for a Jira instance
 * Helps users discover what fields they can add to their config
 */
import { z } from 'zod';
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

const ListCustomFieldsSchema = z.object({
  working_dir: z.string().describe('Working directory containing .jira-config.json'),
  instance: z.string().optional().describe('Optional instance name (e.g., "highway", "onvex")'),
  projectKey: z
    .string()
    .optional()
    .describe('Optional project key to show project-specific fields'),
  showSystemFields: z
    .boolean()
    .optional()
    .describe('Include system fields in the output (default: false)'),
});

interface FieldInfo {
  id: string;
  name: string;
  type: string;
  custom: boolean;
  description?: string;
  allowedValues?: string[];
}

/**
 * Lists all available fields with their IDs and types
 * Provides configuration snippets for easy copy-paste
 */
export async function listCustomFields(
  args: z.infer<typeof ListCustomFieldsSchema>,
  sessionState?: SessionState
): Promise<string> {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance }) => {
      console.error('[list-custom-fields] Fetching all fields', {
        instance: args.instance,
        projectKey: args.projectKey,
        showSystemFields: args.showSystemFields,
      });

      // Fetch all fields
      const response = await axiosInstance.get('/field');
      const allFields: any[] = response.data;

      // Filter to custom fields unless system fields requested
      const fields = args.showSystemFields ? allFields : allFields.filter(f => f.custom);

      // Group fields by type for better organization
      const fieldsByType: Record<string, FieldInfo[]> = {};

      for (const field of fields) {
        const fieldInfo: FieldInfo = {
          id: field.id,
          name: field.name,
          type: field.schema?.type || 'unknown',
          custom: field.custom,
        };

        // Group by schema type
        const typeKey = field.schema?.type || 'unknown';
        if (!fieldsByType[typeKey]) {
          fieldsByType[typeKey] = [];
        }
        fieldsByType[typeKey].push(fieldInfo);
      }

      // Build output
      let output = `# Available Fields for ${args.instance || 'default'} Instance\n\n`;

      // Show summary
      output += `📊 **Field Summary**:\n`;
      output += `- Total fields: ${fields.length}\n`;
      output += `- Custom fields: ${fields.filter(f => f.custom).length}\n`;
      if (args.showSystemFields) {
        output += `- System fields: ${fields.filter(f => !f.custom).length}\n`;
      }
      output += `\n`;

      // Show fields by type
      output += `## Fields by Type\n\n`;

      // Sort types for consistent output
      const sortedTypes = Object.keys(fieldsByType).sort();

      for (const type of sortedTypes) {
        const typeFields = fieldsByType[type].sort((a, b) => a.name.localeCompare(b.name));

        output += `### ${type} Fields (${typeFields.length})\n\n`;

        for (const field of typeFields) {
          const marker = field.custom ? '🔧' : '📦';
          output += `${marker} **${field.name}**\n`;
          output += `   - ID: \`${field.id}\`\n`;
          output += `   - Type: ${field.type}\n`;
          if (!field.custom) {
            output += `   - System field\n`;
          }
          output += `\n`;
        }
      }

      // Add configuration example
      output += `## 📋 Configuration Example\n\n`;
      output += `To use custom fields in your \`.jira-config.json\`, add them to your instance or project configuration:\n\n`;
      output += `\`\`\`json\n`;
      output += `{\n`;
      output += `  "instances": {\n`;
      output += `    "${args.instance || 'your-instance'}": {\n`;
      output += `      "email": "your-email@example.com",\n`;
      output += `      "apiToken": "your-token",\n`;
      output += `      "domain": "your-domain",\n`;
      output += `      "defaultFields": {\n`;
      output += `        "storyPointsField": "customfield_10036",\n`;
      output += `        "sprintField": "customfield_10020",\n`;
      output += `        "epicLinkField": "customfield_10014",\n`;
      output += `        // Add any custom field here:\n`;
      output += `        "customFieldName": "customfield_ID"\n`;
      output += `      }\n`;
      output += `    }\n`;
      output += `  },\n`;
      output += `  "projects": {\n`;
      output += `    "PROJECT": {\n`;
      output += `      "instance": "${args.instance || 'your-instance'}",\n`;
      output += `      // Override or add project-specific fields:\n`;
      output += `      "anotherCustomField": "customfield_ID"\n`;
      output += `    }\n`;
      output += `  }\n`;
      output += `}\n`;
      output += `\`\`\`\n\n`;

      // Add suggested commonly used fields
      const commonFields = fields.filter(f =>
        /story|point|sprint|epic|estimate|priority|component|version|rank/i.test(f.name)
      );

      if (commonFields.length > 0) {
        output += `## 🎯 Commonly Used Fields\n\n`;
        output += `Based on field names, these might be useful for your configuration:\n\n`;

        for (const field of commonFields) {
          output += `- **${field.name}**: \`${field.id}\` (${field.schema?.type || 'unknown'})\n`;
        }
        output += `\n`;
      }

      console.error('[list-custom-fields] Successfully listed', fields.length, 'fields');
      return output;
    },
    sessionState
  );
}

export const listCustomFieldsTool = {
  name: 'list_custom_fields',
  description:
    'List all available custom and system fields for a Jira instance. Shows field IDs, types, and provides configuration examples. Useful for discovering what fields can be added to your configuration.',
  inputSchema: ListCustomFieldsSchema,
  handler: listCustomFields,
};
