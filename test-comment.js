#!/usr/bin/env node
import axios from 'axios';
import fs from 'fs';
import path from 'path';

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
            text: "Test comment from direct API call",
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

console.log('Request body:', JSON.stringify(requestBody, null, 2));

axios({
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
})
.then(response => {
  console.log('SUCCESS!');
  console.log('Status:', response.status);
  console.log('Response:', response.data);
})
.catch(error => {
  console.log('ERROR!');
  console.log('Status:', error.response?.status);
  console.log('Response data:', JSON.stringify(error.response?.data, null, 2));
  console.log('Headers:', error.response?.headers);
});