/**
 * Dynamic field resolver for handling custom fields by name or ID
 * Allows flexible field mapping without hard-coding specific fields
 */
import { AxiosInstance } from 'axios';
import type { SessionState } from '../session-manager.js';

interface FieldMetadata {
  id: string;
  name: string;
  type: string;
  custom: boolean;
  schema?: {
    type: string;
    items?: string;
    system?: string;
  };
}

// Cache field metadata per session to avoid repeated API calls
const fieldCacheKey = (instance: string) => `fields:${instance}`;

/**
 * Get all field metadata for an instance with caching
 */
export async function getFieldMetadata(
  axiosInstance: AxiosInstance,
  instanceName: string,
  session?: SessionState
): Promise<FieldMetadata[]> {
  // Check session cache if available
  const cacheKey = fieldCacheKey(instanceName);
  if (session?.configCache.has(cacheKey)) {
    return session.configCache.get(cacheKey) as FieldMetadata[];
  }

  // Fetch from API
  const response = await axiosInstance.get('/field');
  const fields = response.data as FieldMetadata[];

  // Cache for session
  if (session) {
    session.configCache.set(cacheKey, fields);
  }

  return fields;
}

/**
 * Resolve a field identifier (name or ID) to its actual field ID with fuzzy matching
 * @param fieldIdentifier - Can be a field name (e.g., "Story Points") or ID (e.g., "customfield_10036")
 * @param fields - Array of field metadata
 * @returns Object with field ID and match info, or null if not found
 */
export function resolveFieldId(
  fieldIdentifier: string,
  fields: FieldMetadata[]
): { fieldId: string; matchType: 'exact-id' | 'exact-name' | 'fuzzy' | 'partial' } | null {
  const normalizedInput = fieldIdentifier.toLowerCase().trim();

  // 1. If it already looks like a field ID, validate it exists
  if (fieldIdentifier.startsWith('customfield_') || /^[a-z]+$/.test(fieldIdentifier)) {
    const field = fields.find(f => f.id === fieldIdentifier);
    if (field) {
      return { fieldId: field.id, matchType: 'exact-id' };
    }
  }

  // 2. Try exact name match (case-insensitive)
  let field = fields.find(f => f.name.toLowerCase() === normalizedInput);
  if (field) {
    return { fieldId: field.id, matchType: 'exact-name' };
  }

  // 3. Try fuzzy matching - normalize both strings by removing special chars and spaces
  const normalizeForFuzzy = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const fuzzyInput = normalizeForFuzzy(fieldIdentifier);
  field = fields.find(f => normalizeForFuzzy(f.name) === fuzzyInput);
  if (field) {
    return { fieldId: field.id, matchType: 'fuzzy' };
  }

  // 4. Try partial matching (input contains field name or vice versa)
  field = fields.find(f => {
    const fieldNameNormalized = f.name.toLowerCase();
    return (
      fieldNameNormalized.includes(normalizedInput) || normalizedInput.includes(fieldNameNormalized)
    );
  });
  if (field) {
    return { fieldId: field.id, matchType: 'partial' };
  }

  return null;
}

/**
 * Convert a value to the appropriate type based on field schema
 * @param value - The value to convert
 * @param field - The field metadata
 * @returns The converted value
 */
export function convertFieldValue(value: any, field: FieldMetadata): any {
  if (!field.schema) return value;

  // Special handling for time tracking fields (Original estimate, Remaining estimate, etc.)
  // Jira time format: '1w 2d 3h 20m' - preserve this format
  if (typeof value === 'string' && /\d+[wdhm]/.test(value)) {
    // If the value contains time format patterns like '1w', '2d', '3h', '20m', preserve as-is
    return value;
  }

  switch (field.schema.type) {
    case 'number':
      // Check if it's a time tracking system field that expects time format
      if (
        field.schema.system &&
        (field.schema.system.includes('time') ||
          field.id === 'timeoriginalestimate' ||
          field.id === 'timeestimate')
      ) {
        // For time tracking fields, if it's not already in time format, preserve the original value
        return value;
      }
      return typeof value === 'number' ? value : parseFloat(value);

    case 'string':
      return String(value);

    case 'array':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(',').map(v => v.trim());
      return [value];

    case 'date':
    case 'datetime':
      // Ensure ISO format for dates
      if (value instanceof Date) return value.toISOString();
      return value;

    case 'user':
      // User fields need special handling - return as-is for now
      // The calling code should handle user resolution
      return value;

    case 'team':
      // Team fields need team objects, not just strings
      // For now, return as-is and let Jira handle it (may need enhancement)
      return value;

    case 'option':
      // Single select fields
      if (typeof value === 'object' && value.value) return value;
      return { value: String(value) };

    case 'option-with-child':
      // Cascading select fields
      return value;

    default:
      return value;
  }
}

/**
 * Build dynamic fields object from configuration with enhanced error reporting
 * @param configFields - Object mapping field names/IDs to values
 * @param axiosInstance - Axios instance for API calls
 * @param instanceName - Name of the Jira instance
 * @param session - Optional session for caching
 * @returns Object with resolved field IDs as keys and metadata about resolution
 */
export async function buildDynamicFields(
  configFields: Record<string, any>,
  axiosInstance: AxiosInstance,
  instanceName: string,
  session?: SessionState,
  issueKey?: string
): Promise<{
  resolvedFields: Record<string, any>;
  fieldResolutions: Array<{
    input: string;
    resolved?: string;
    matchType?: string;
    fieldName?: string;
    error?: string;
  }>;
}> {
  // Get all field metadata
  const fields = await getFieldMetadata(axiosInstance, instanceName, session);

  // Get editable fields if issue key provided
  let editableFields: Record<string, any> | undefined;
  if (issueKey) {
    try {
      const editMetaResponse = await axiosInstance.get(`/issue/${issueKey}/editmeta`);
      editableFields = editMetaResponse.data.fields;
    } catch (error) {
      console.error('Warning: Could not fetch editable fields metadata:', error);
    }
  }

  const resolvedFields: Record<string, any> = {};
  const fieldResolutions: Array<{
    input: string;
    resolved?: string;
    matchType?: string;
    fieldName?: string;
    error?: string;
  }> = [];

  for (const [fieldKey, fieldValue] of Object.entries(configFields)) {
    // Skip if value is undefined or null
    if (fieldValue === undefined || fieldValue === null) {
      fieldResolutions.push({
        input: fieldKey,
        error: 'Value is undefined or null',
      });
      continue;
    }

    // Special handling for components field
    if (fieldKey.toLowerCase() === 'component' || fieldKey.toLowerCase() === 'components') {
      // Components is a system field that needs array of objects with name property
      const componentValue = Array.isArray(fieldValue)
        ? fieldValue.map(v => (typeof v === 'string' ? { name: v } : v))
        : [{ name: fieldValue }];

      resolvedFields['components'] = componentValue;
      console.error(
        `✅ Special handling for Component field: setting to ${JSON.stringify(componentValue)}`
      );
      fieldResolutions.push({
        input: fieldKey,
        resolved: 'components',
        matchType: 'system-field',
        fieldName: 'Component/s',
      });
      continue;
    }

    // Special handling for composite time tracking field
    if (fieldKey.toLowerCase() === 'time tracking' || fieldKey.toLowerCase() === 'timetracking') {
      // Time tracking is a composite field that needs special structure
      const timetrackingField = fields.find(f => f.id === 'timetracking');
      if (timetrackingField) {
        // Parse the time value - it could be for original or remaining estimate
        resolvedFields['timetracking'] = {
          originalEstimate: fieldValue, // Use the value for original estimate
        };
        console.error(
          `✅ Special handling for Time tracking field: setting originalEstimate to "${fieldValue}"`
        );
        fieldResolutions.push({
          input: fieldKey,
          resolved: 'timetracking',
          matchType: 'composite',
          fieldName: 'Time tracking',
        });
        continue;
      }
    }

    // Special handling for direct time estimate fields
    if (
      fieldKey.toLowerCase() === 'original estimate' ||
      fieldKey.toLowerCase() === 'originalestimate'
    ) {
      // Map to the actual field ID
      const originalEstimateField = fields.find(
        f => f.id === 'timeoriginalestimate' || f.name === 'Original estimate'
      );
      if (originalEstimateField) {
        // For updates, use timetracking composite field
        resolvedFields['timetracking'] = resolvedFields['timetracking'] || {};
        resolvedFields['timetracking']['originalEstimate'] = fieldValue;
        console.error(
          `✅ Mapped "Original estimate" to timetracking.originalEstimate: "${fieldValue}"`
        );
        fieldResolutions.push({
          input: fieldKey,
          resolved: 'timetracking',
          matchType: 'timetracking-component',
          fieldName: 'Original estimate (via timetracking)',
        });
        continue;
      }
    }

    if (
      fieldKey.toLowerCase() === 'remaining estimate' ||
      fieldKey.toLowerCase() === 'remainingestimate'
    ) {
      // Map to the actual field ID
      const remainingEstimateField = fields.find(
        f => f.id === 'timeestimate' || f.name === 'Remaining Estimate'
      );
      if (remainingEstimateField) {
        // For updates, use timetracking composite field
        resolvedFields['timetracking'] = resolvedFields['timetracking'] || {};
        resolvedFields['timetracking']['remainingEstimate'] = fieldValue;
        console.error(
          `✅ Mapped "Remaining estimate" to timetracking.remainingEstimate: "${fieldValue}"`
        );
        fieldResolutions.push({
          input: fieldKey,
          resolved: 'timetracking',
          matchType: 'timetracking-component',
          fieldName: 'Remaining estimate (via timetracking)',
        });
        continue;
      }
    }

    // Resolve field ID with enhanced matching
    const resolution = resolveFieldId(fieldKey, fields);
    if (!resolution) {
      // Provide suggestions for unmatched fields
      const suggestions = fields
        .filter(f => f.name.toLowerCase().includes(fieldKey.toLowerCase().substring(0, 3)))
        .map(f => f.name)
        .slice(0, 3);

      const errorMsg =
        suggestions.length > 0
          ? `Field "${fieldKey}" not found. Similar fields: ${suggestions.join(', ')}`
          : `Field "${fieldKey}" not found in Jira instance`;

      console.error(`❌ ${errorMsg}`);
      fieldResolutions.push({
        input: fieldKey,
        error: errorMsg,
      });
      continue;
    }

    // Get field metadata
    const field = fields.find(f => f.id === resolution.fieldId);
    if (!field) {
      fieldResolutions.push({
        input: fieldKey,
        error: 'Field metadata not found',
      });
      continue;
    }

    // Check if field is editable on this issue (if we have edit metadata)
    if (editableFields && !editableFields[resolution.fieldId]) {
      const warningMsg = `Field "${field.name}" is not editable on this issue (not on screen configuration or restricted by workflow)`;
      console.error(`⚠️  ${warningMsg}`);
      fieldResolutions.push({
        input: fieldKey,
        error: warningMsg,
      });
      continue;
    }

    // Convert value to appropriate type
    const convertedValue = convertFieldValue(fieldValue, field);
    resolvedFields[resolution.fieldId] = convertedValue;

    console.error(
      `✅ Field resolved: "${fieldKey}" -> "${field.name}" (${resolution.fieldId}) [${resolution.matchType} match]`
    );
    fieldResolutions.push({
      input: fieldKey,
      resolved: resolution.fieldId,
      matchType: resolution.matchType,
      fieldName: field.name,
    });
  }

  return { resolvedFields, fieldResolutions };
}

/**
 * Extract known system fields from a configuration object
 * These don't need dynamic resolution
 */
export function extractSystemFields(config: any): {
  systemFields: Record<string, any>;
  customFields: Record<string, any>;
} {
  const systemFieldNames = [
    'summary',
    'description',
    'issuetype',
    'priority',
    'labels',
    'components',
    'versions',
    'fixVersions',
    'duedate',
    'assignee',
    'reporter',
    'parent',
    'project',
  ];

  const systemFields: Record<string, any> = {};
  const customFields: Record<string, any> = {};

  for (const [key, value] of Object.entries(config)) {
    if (systemFieldNames.includes(key.toLowerCase())) {
      systemFields[key.toLowerCase()] = value;
    } else {
      customFields[key] = value;
    }
  }

  return { systemFields, customFields };
}
