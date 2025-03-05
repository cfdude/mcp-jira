/**
 * Handler for the list_issues tool
 */
import { AxiosInstance } from "axios";
import { ListIssuesArgs } from "../types.js";
import { formatIssueList } from "../utils/formatting.js";

export async function handleListIssues(
  axiosInstance: AxiosInstance,
  defaultProjectKey: string,
  storyPointsField: string | null,
  args: ListIssuesArgs
) {
  const { status, projectKey } = args;
  
  // Use provided projectKey if it exists, otherwise use the default
  const effectiveProjectKey = projectKey || defaultProjectKey;
  
  // Build JQL query based on status filter
  const jql = status
    ? `project = ${effectiveProjectKey} AND status = "${status}" ORDER BY created DESC`
    : `project = ${effectiveProjectKey} ORDER BY created DESC`;

  // Get fields to retrieve, including story points if configured
  const fields = [
    "summary",
    "description",
    "status",
    "issuetype",
    "created",
    "creator",
    "priority",
    "labels",
    "parent",
    "comment"
  ];

  // Add story points field if configured
  if (storyPointsField) {
    fields.push(storyPointsField);
  }

  // Search for issues
  const searchResponse = await axiosInstance.get("/search", {
    params: {
      jql,
      fields,
    },
  });

  return {
    content: [
      {
        type: "text",
        text: formatIssueList(searchResponse.data.issues, effectiveProjectKey, storyPointsField),
      },
    ],
  };
}