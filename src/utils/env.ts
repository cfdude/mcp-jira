export function getJiraEmail(): string | undefined {
  return process.env.JIRA_EMAIL || undefined;
}

export function getJiraApiToken(): string | undefined {
  return process.env.JIRA_API_TOKEN || undefined;
}

export function getJiraDomain(): string | undefined {
  return process.env.JIRA_DOMAIN || undefined;
}
