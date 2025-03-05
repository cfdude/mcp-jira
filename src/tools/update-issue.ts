/**
 * Handler for the update_issue tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { UpdateIssueArgs } from "../types.js";
import { getBoardId } from "../utils/jira-api.js";
import { formatIssue } from "../utils/formatting.js";

export async function handleUpdateIssue(
  axiosInstance: AxiosInstance,
  agileAxiosInstance: AxiosInstance,
  projectKey: string,
  storyPointsField: string | null,
  args: UpdateIssueArgs
) {
  const { issue_key, summary, description, status, epic_link, sprint, priority, story_points, labels } = args;
  
  const updateData: any = {
    fields: {},
  };

  // Add fields to update if provided
  if (summary) updateData.fields.summary = summary;
  if (description) updateData.fields.description = description;
  if (priority) {
    updateData.fields.priority = { name: priority };
    console.error("Setting priority:", priority);
  }
  if (story_points !== undefined && storyPointsField) {
    updateData.fields[storyPointsField] = story_points;
    console.error("Setting story points:", story_points);
  }
  if (labels !== undefined) {
    updateData.fields.labels = labels || [];
    console.error("Setting labels:", labels);
  }
  if (epic_link) {
    updateData.fields.parent = {
      key: epic_link
    };
    console.error("Adding Epic link using parent field:", epic_link);
  }

  // Handle sprint field update
  if (sprint !== undefined) {
    // Get field configuration to find Sprint field ID
    const fieldConfigResponse = await axiosInstance.get(
      `/field`,
      {
        params: {
          expand: 'names',
        },
      }
    );

    let sprintFieldId;
    for (const field of fieldConfigResponse.data) {
      if (field.name === 'Sprint') {
        sprintFieldId = field.id;
        break;
      }
    }

    if (!sprintFieldId) {
      throw new McpError(ErrorCode.InvalidRequest, 'Sprint field not found');
    }

    if (sprint === '') {
      // Remove from sprint
      updateData.fields[sprintFieldId] = null;
      console.error("Removing issue from sprint");
    } else {
      // Add to specified sprint
      const boardId = await getBoardId(agileAxiosInstance, projectKey);
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
      updateData.fields[sprintFieldId] = numericSprintId;
      console.error("Adding issue to sprint:", {
        fieldId: sprintFieldId,
        sprintId: numericSprintId,
        sprintName: sprintObj.name,
        fieldValue: updateData.fields[sprintFieldId]
      });
    }
  }

  // Handle status transitions
  if (status) {
    console.error(`Fetching transitions for status update to ${status}...`);
    const transitions = await axiosInstance.get(
      `/issue/${issue_key}/transitions`
    );
    const transition = transitions.data.transitions.find(
      (t: any) => t.name.toLowerCase() === status.toLowerCase()
    );
    if (transition) {
      console.error(`Applying transition ID ${transition.id}...`);
      await axiosInstance.post(
        `/issue/${issue_key}/transitions`,
        {
          transition: { id: transition.id },
        }
      );
    } else {
      console.error(`No transition found for status: ${status}`);
      console.error(`Available transitions: ${transitions.data.transitions.map((t: any) => t.name).join(', ')}`);
    }
  }

  // Apply updates if there are any
  if (Object.keys(updateData.fields).length > 0) {
    console.error("Applying field updates:", JSON.stringify(updateData, null, 2));
    await axiosInstance.put(`/issue/${issue_key}`, updateData);
  } else {
    console.error("No field updates to apply");
  }

  // Fetch updated issue
  console.error("Fetching updated issue...");
  const updatedIssue = await axiosInstance.get(
    `/issue/${issue_key}`,
    {
      params: {
        expand: "renderedFields,names,schema,transitions,operations,editmeta,changelog",
      },
    }
  );
  
  return {
    content: [
      {
        type: "text",
        text: formatIssue(updatedIssue.data, storyPointsField),
      },
    ],
  };
}