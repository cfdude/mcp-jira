#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs';

// Read config
const config = JSON.parse(fs.readFileSync('.jira-config.json', 'utf8'));

async function detectAllFields(instance, projectKey) {
  const instanceConfig = config.instances[instance];
  
  const axiosInstance = axios.create({
    baseURL: `https://${instanceConfig.domain}.atlassian.net/rest/api/3`,
    auth: {
      username: instanceConfig.email,
      password: instanceConfig.apiToken
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  try {
    // Get all fields
    const response = await axiosInstance.get('/field');
    const fields = response.data;
    
    console.log(`\n=== ${projectKey} (${instance}) ===`);
    
    // Find sprint field - look for various patterns
    const sprintFields = fields.filter(f => 
      f.name?.toLowerCase().includes('sprint') ||
      f.id?.includes('sprint') ||
      f.schema?.system?.includes('greenhopper')
    );
    
    if (sprintFields.length > 0) {
      console.log('\nSprint fields found:');
      sprintFields.forEach(f => {
        console.log(`  - ${f.name} (${f.id}) - ${f.schema?.type || 'unknown type'}`);
      });
    }
    
    // Find epic fields
    const epicFields = fields.filter(f => 
      f.name?.toLowerCase().includes('epic') ||
      f.id?.includes('epic') ||
      (f.schema?.system?.includes('greenhopper') && f.name?.toLowerCase().includes('epic'))
    );
    
    if (epicFields.length > 0) {
      console.log('\nEpic fields found:');
      epicFields.forEach(f => {
        console.log(`  - ${f.name} (${f.id}) - ${f.schema?.type || 'unknown type'}`);
      });
    }
    
    // Find story points fields
    const storyPointsFields = fields.filter(f => 
      f.name?.toLowerCase().includes('story') ||
      f.name?.toLowerCase().includes('point') ||
      f.name?.toLowerCase().includes('estimate')
    );
    
    if (storyPointsFields.length > 0) {
      console.log('\nStory Points fields found:');
      storyPointsFields.forEach(f => {
        console.log(`  - ${f.name} (${f.id}) - ${f.schema?.type || 'unknown type'}`);
      });
    }
    
    // Show all custom fields for debugging
    const customFields = fields.filter(f => f.custom);
    console.log(`\nAll custom fields (${customFields.length} total):`);
    customFields.slice(0, 20).forEach(f => {
      console.log(`  - ${f.name} (${f.id})`);
    });
    
  } catch (error) {
    console.error(`Error detecting fields for ${projectKey}:`, error.message);
  }
}

async function main() {
  // Detect for all projects
  for (const [projectKey, projectConfig] of Object.entries(config.projects)) {
    await detectAllFields(projectConfig.instance, projectKey);
  }
}

main().catch(console.error);