/**
 * Tool to list available Jira instances and their configurations
 */
import { listAvailableInstances } from '../config.js';
import type { SessionState } from '../session-manager.js';

interface ListInstancesArgs {
  working_dir: string;
  instance?: string;
}

export async function handleListInstances(args: ListInstancesArgs, session?: SessionState) {
  try {
    const { instances, projects } = await listAvailableInstances(args.working_dir);

    let result = '# Available Jira Instances\n\n';

    if (instances.length === 0) {
      result += 'No Jira instances configured.\n\n';
      result +=
        'To configure multiple instances, create a .jira-config.json file with this structure:\n';
      result += '```json\n';
      result += JSON.stringify(
        {
          instances: {
            highway: {
              email: 'your.email@highway.ai',
              apiToken: 'your-api-token',
              domain: 'listreports',
              projects: ['HWY', 'PROD'],
            },
            onvex: {
              email: 'your.email@onvex.ai',
              apiToken: 'your-api-token',
              domain: 'onvex',
              projects: ['ONVX', 'DEV'],
            },
          },
          projects: {
            HWY: {
              instance: 'highway',
              storyPointsField: 'customfield_10016',
            },
            ONVX: {
              instance: 'onvex',
              storyPointsField: 'customfield_10020',
            },
          },
          defaultInstance: 'highway',
        },
        null,
        2
      );
      result += '\n```\n';
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    }

    // List instances
    result += '## Configured Instances\n\n';
    instances.forEach((instance, index) => {
      result += `### ${index + 1}. ${instance.name}\n`;
      result += `- **Domain**: ${instance.domain}.atlassian.net\n`;
      result += `- **Email**: ${instance.email}\n`;
      result += `- **Pre-configured Projects**: ${instance.configuredProjects.length > 0 ? instance.configuredProjects.join(', ') : 'None'}\n\n`;
    });

    // List project mappings
    if (projects.length > 0) {
      result += '## Project-to-Instance Mappings\n\n';
      projects.forEach(project => {
        result += `- **${project.projectKey}** → ${project.instance}\n`;
      });
      result += '\n';
    }

    // Usage guidance
    result += '## Usage Guidelines\n\n';
    result += '### Automatic Instance Selection\n';
    result +=
      '1. **Explicit Project Mapping**: If a project is configured in the `projects` section, that instance will be used\n';
    result +=
      '2. **Instance Project Lists**: If an instance lists the project in its `projects` array, that instance will be used\n';
    result +=
      '3. **Default Instance**: If configured, the default instance will be used for unmapped projects\n';
    result +=
      '4. **Single Instance**: If only one instance is configured, it will be used for all projects\n\n';

    result += '### Manual Instance Selection\n';
    result +=
      'You can override automatic selection by adding an `instance` parameter to any tool call:\n';
    result += '```json\n';
    result += JSON.stringify(
      {
        working_dir: '/path/to/config',
        projectKey: 'PROJ',
        instance: 'highway',
        summary: 'New feature request',
      },
      null,
      2
    );
    result += '\n```\n\n';

    result += '### Adding New Projects\n';
    result += "When you use a project key that isn't configured:\n";
    result += '1. The system will attempt auto-discovery based on instance project lists\n';
    result += '2. Fall back to the default instance if configured\n';
    result += "3. Use the only available instance if there's just one\n";
    result += '4. Prompt you to specify an instance if multiple are available\n\n';

    result += '### Configuration Examples\n\n';
    result += '**Multi-instance setup:**\n';
    result += '```json\n';
    result += JSON.stringify(
      {
        instances: {
          highway: {
            email: 'user@highway.ai',
            apiToken: 'highway-token',
            domain: 'listreports',
            projects: ['HWY', 'PROD', 'OPS'],
          },
          onvex: {
            email: 'user@onvex.ai',
            apiToken: 'onvex-token',
            domain: 'onvex',
            projects: ['ONVX', 'DEV', 'TEST'],
          },
        },
        projects: {
          HWY: { instance: 'highway', storyPointsField: 'customfield_10016' },
          PROD: { instance: 'highway', storyPointsField: 'customfield_10016' },
          ONVX: { instance: 'onvex', storyPointsField: 'customfield_10020' },
        },
        defaultInstance: 'highway',
      },
      null,
      2
    );
    result += '\n```\n\n';

    result += '**Legacy single-instance (still supported):**\n';
    result += '```json\n';
    result += JSON.stringify(
      {
        projectKey: 'PROJ',
        storyPointsField: 'customfield_10016',
      },
      null,
      2
    );
    result += '\n```\n';

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    console.error('Error listing instances:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        },
      ],
    };
  }
}
