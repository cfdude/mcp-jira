/**
 * Handler for the create_issue tool with multi-instance support
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { CreateIssueArgs } from "../types.js";
import { getBoardId, createJiraApiInstances } from "../utils/jira-api.js";
import { formatCreatedIssue } from "../utils/formatting.js";
import { getInstanceForProject } from "../config.js";

export async function handleCreateIssue(
  args: CreateIssueArgs
) {
  const { summary, description, type, epic_link, sprint, priority, story_points, labels, projectKey, working_dir, instance } = args;
  
  // Determine which project key to use
  const effectiveProjectKey = projectKey || "UNKNOWN";
  
  if (effectiveProjectKey === "UNKNOWN") {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "projectKey is required when creating issues. Either provide it as a parameter or configure a default project in .jira-config.json"
    );
  }

  // Get the appropriate instance and project configuration
  const { instance: instanceConfig, projectConfig } = await getInstanceForProject(
    working_dir, 
    effectiveProjectKey, 
    instance
  );
  
  // Create API instances for this specific Jira instance
  const { axiosInstance, agileAxiosInstance } = createJiraApiInstances(instanceConfig);
  
  console.error(`Creating issue in project ${effectiveProjectKey} using instance: ${instanceConfig.domain}`);

  console.error("Creating issue with:", {
    projectKey: effectiveProjectKey,
    summary,
    description,
    type,
    epic_link,
    sprint,
    priority,
    story_points,
    labels,
    instance: instanceConfig.domain
  });

  // First, get project metadata to verify it exists and get available issue types
  const metaResponse = await axiosInstance.get(
    "/issue/createmeta",
    {
      params: {
        projectKeys: effectiveProjectKey,
        expand: "projects.issuetypes",
      },
    }
  );

  console.error(
    "Project metadata:",
    JSON.stringify(metaResponse.data, null, 2)
  );

  const project = metaResponse.data.projects[0];
  if (!project) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Project ${effectiveProjectKey} not found`
    );
  }

  const issueType = project.issuetypes.find(
    (t: any) => t.name.toLowerCase() === type.toLowerCase()
  );
  if (!issueType) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Issue type "${type}" not found. Available types: ${project.issuetypes
        .map((t: any) => t.name)
        .join(", ")}`
    );
  }

  // Use configured sprint field or default
  const sprintFieldId = projectConfig.sprintField || 'customfield_10020';
  console.error("Using sprint field ID:", sprintFieldId);

  const fields: any = {
    project: {
      key: effectiveProjectKey,
    },
    summary,
    description,
    issuetype: {
      name: type
    },
    labels: labels || []
  };

  // Add priority if specified
  if (priority) {
    fields.priority = {
      name: priority
    };
    console.error("Setting priority:", priority);
  }

  // Add story points if specified
  if (story_points !== undefined && projectConfig.storyPointsField) {
    fields[projectConfig.storyPointsField] = story_points;
    console.error("Setting story points:", story_points, "using field:", projectConfig.storyPointsField);
  }

  // Handle sprint assignment if requested
  if (sprint && sprintFieldId) {
    try {
      const boardId = await getBoardId(agileAxiosInstance, effectiveProjectKey);
      console.error("Found board ID:", boardId);

      // Get available sprints
      const sprintsResponse = await agileAxiosInstance.get(
        `/board/${boardId}/sprint`,
        {
          params: {
            state: sprint.toLowerCase() === 'current' ? 'active' : 'active,future'
          }
        }
      );

      console.error("Available sprints:", JSON.stringify(sprintsResponse.data, null, 2));

      // Find the requested sprint
      const sprintObj = sprint.toLowerCase() === 'current'
        ? sprintsResponse.data.values.find((s: any) => s.state === 'active')
        : sprintsResponse.data.values.find((s: any) => s.name.toLowerCase() === sprint.toLowerCase());

      if (!sprintObj) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Sprint "${sprint}" not found. Available sprints: ${sprintsResponse.data.values.map((s: any) => s.name).join(', ')}`
        );
      }

      // Convert sprint ID to number and validate
      const numericSprintId = Number(sprintObj.id);
      if (isNaN(numericSprintId)) {
        throw new McpError(ErrorCode.InvalidRequest, `Invalid sprint ID: ${sprintObj.id} is not a number`);
      }

      // Set sprint field with just the numeric ID
      fields[sprintFieldId] = numericSprintId;

      console.error("Setting sprint field:", {
        fieldId: sprintFieldId,
        sprintId: numericSprintId,
        sprintName: sprintObj.name,
        fieldValue: fields[sprintFieldId]
      });

      // Create issue with sprint field
      const createResponse = await axiosInstance.post("/issue", {
        fields
      });

      return {
        content: [
          {
            type: "text",
            text: formatCreatedIssue(createResponse.data, instanceConfig.domain),
          },
        ],
      };
    } catch (error) {
      console.error("Error setting sprint:", error);
      throw error;
    }
  }

  if (epic_link) {
    // Use configured epic link field or try parent field
    if (projectConfig.epicLinkField) {
      fields[projectConfig.epicLinkField] = epic_link;
      console.error("Adding Epic link using configured field:", projectConfig.epicLinkField, epic_link);
    } else {
      fields.parent = {
        key: epic_link
      };
      console.error("Adding Epic link using parent field:", epic_link);
    }
  }

  const createResponse = await axiosInstance.post("/issue", {
    fields,
  });

  return {
    content: [
      {
        type: "text",
        text: formatCreatedIssue(createResponse.data, instanceConfig.domain),
      },
    ],
  };
}