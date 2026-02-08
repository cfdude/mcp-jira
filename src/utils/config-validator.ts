/**
 * Configuration validation utilities
 */
import type { JiraInstanceConfig, MultiInstanceJiraConfig } from '../types.js';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single Jira instance configuration
 */
export function validateInstanceConfig(
  instanceName: string,
  config: JiraInstanceConfig
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!config.email || config.email.trim() === '') {
    errors.push(`Instance '${instanceName}': email is required`);
  } else if (!config.email.includes('@')) {
    warnings.push(`Instance '${instanceName}': email format may be invalid`);
  }

  if (!config.apiToken || config.apiToken.trim() === '') {
    errors.push(`Instance '${instanceName}': apiToken is required`);
  } else if (
    config.apiToken === 'TEST_TOKEN' ||
    config.apiToken === 'YOUR_API_TOKEN' ||
    config.apiToken.includes('YOUR_')
  ) {
    errors.push(
      `Instance '${instanceName}': apiToken appears to be a placeholder - please set a real API token`
    );
  } else if (config.apiToken.length < 20) {
    warnings.push(`Instance '${instanceName}': apiToken appears too short to be valid`);
  }

  if (!config.domain || config.domain.trim() === '') {
    errors.push(`Instance '${instanceName}': domain is required`);
  } else {
    // Use exact suffix matching to detect when users include the full domain
    const normalizedDomain = config.domain.replace(/\/+$/, '').toLowerCase();
    if (normalizedDomain.endsWith('.atlassian.net') || normalizedDomain === 'atlassian.net') {
      warnings.push(
        `Instance '${instanceName}': domain should not include '.atlassian.net' - use just the subdomain`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate the complete multi-instance configuration
 */
export function validateMultiInstanceConfig(
  config: MultiInstanceJiraConfig
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any instances are defined
  if (!config.instances || Object.keys(config.instances).length === 0) {
    errors.push('No instances defined in configuration');
    return { isValid: false, errors, warnings };
  }

  // Validate each instance
  for (const [instanceName, instanceConfig] of Object.entries(config.instances)) {
    const instanceValidation = validateInstanceConfig(instanceName, instanceConfig);
    errors.push(...instanceValidation.errors);
    warnings.push(...instanceValidation.warnings);
  }

  // Validate default instance
  if (config.defaultInstance && !config.instances[config.defaultInstance]) {
    errors.push(`Default instance '${config.defaultInstance}' is not defined in instances`);
  }

  // Validate project mappings
  if (config.projects) {
    for (const [projectKey, projectConfig] of Object.entries(config.projects)) {
      if (!config.instances[projectConfig.instance]) {
        errors.push(
          `Project '${projectKey}' references undefined instance '${projectConfig.instance}'`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation results as a user-friendly message
 */
export function formatValidationResults(
  results: ConfigValidationResult,
  context: string = 'Configuration'
): string {
  let message = `${context} Validation:\n\n`;

  if (results.isValid) {
    message += '✅ Configuration is valid!\n';
  } else {
    message += '❌ Configuration has errors:\n\n';
    results.errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`;
    });
  }

  if (results.warnings.length > 0) {
    message += '\n⚠️ Warnings:\n\n';
    results.warnings.forEach((warning, index) => {
      message += `${index + 1}. ${warning}\n`;
    });
  }

  if (!results.isValid) {
    message += '\n🔧 How to fix:\n';
    message += '1. Update your .jira-config.json file with valid credentials\n';
    message +=
      '2. Get API tokens from: https://id.atlassian.com/manage-profile/security/api-tokens\n';
    message +=
      '3. Use your actual Jira domain subdomain (e.g., "mycompany" for mycompany.atlassian.net)\n';
    message += '4. Use your full email address for the email field\n';
  }

  return message;
}
