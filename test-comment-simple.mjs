#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';

// Load configuration
const configPath = '/Users/robsherman/Documents/Repos/job-search-agent/.jira-config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const onvexConfig = config.instances.onvex;

console.log('Testing Jira comment API...');
console.log('Domain:', onvexConfig.domain);
console.log('Email:', onvexConfig.email);

const baseURL = `https://${onvexConfig.domain}.atlassian.net/rest/api/3`;
const issueKey = 'JOB-110';

const requestBody = {
  body: {
    content: [
      {
        content: [
          {
            text: "Test comment from direct API call - troubleshooting MCP server issue",
            type: "text"
          }
        ],
        type: "paragraph"
      }
    ],
    type: "doc",
    version: 1
  }
};

console.log('Request URL:', `${baseURL}/issue/${issueKey}/comment`);
console.log('Request body:', JSON.stringify(requestBody, null, 2));

try {
  const response = await axios({
    method: 'POST',
    url: `${baseURL}/issue/${issueKey}/comment`,
    auth: {
      username: onvexConfig.email,
      password: onvexConfig.apiToken
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    data: requestBody
  });
  
  console.log('SUCCESS!');
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(response.data, null, 2));
} catch (error) {
  console.log('ERROR!');
  console.log('Status:', error.response?.status);
  console.log('Status Text:', error.response?.statusText);
  console.log('Response data:', JSON.stringify(error.response?.data, null, 2));
  console.log('Request config URL:', error.config?.url);
  console.log('Request config method:', error.config?.method);
  console.log('Request config headers:', JSON.stringify(error.config?.headers, null, 2));
}