# Generic Custom Fields Architecture Enhancement Plan

**Status**: Proposed Enhancement  
**Priority**: Medium-High (Architectural Improvement)  
**Impact**: High (Removes hardcoded limitations, enables unlimited custom field support)

## 🔍 Current Architecture Problems

### Hardcoded Field Limitations
The current system is hardcoded to support exactly **3 custom field types**:
- `storyPointsField` → Story Points
- `sprintField` → Sprint assignment  
- `epicLinkField` → Epic linking

### Code Locations Requiring Changes (Current)
1. **Configuration Schema** (`src/types.ts`): Hardcoded field properties
2. **Tool Parameters**: Each tool has hardcoded parameters like `story_points`, `sprint`
3. **Mapping Logic**: Tools manually map parameters to field IDs

### User Experience Issues
- **Limited Field Access**: Users can't access other custom fields (Priority, Severity, Customer Impact, etc.)
- **Manual Configuration**: Users must hunt for field IDs in Jira admin interface
- **Code Changes Required**: Adding new field types requires development work
- **Discovery Gap**: No way to see what custom fields are available

## 🎯 Proposed Solution: Configuration-Driven Custom Fields

### New Configuration Architecture

**Current Structure (Limited)**:
```json
{
  "projects": {
    "PROJ": {
      "instance": "primary",
      "storyPointsField": "customfield_10016",
      "sprintField": "customfield_10020", 
      "epicLinkField": "customfield_10014"
    }
  }
}
```

**New Structure (Unlimited)**:
```json
{
  "projects": {
    "PROJ": {
      "instance": "primary",
      "customFields": {
        "storyPoints": "customfield_10016",
        "sprint": "customfield_10020",
        "epicLink": "customfield_10014",
        "customerPriority": "customfield_10025",
        "severity": "customfield_10030",
        "businessValue": "customfield_10040",
        "teamAssignment": "customfield_10050"
      }
    }
  }
}
```

### Enhanced Field Detection Tool

**Current `detect_project_fields` Behavior**:
- Detects only Story Points, Sprint, Epic Link fields
- Uses hardcoded heuristics for 3 specific field types
- Outputs configuration for these 3 fields only

**Enhanced `detect_project_fields` Behavior**:
```javascript
detect_project_fields({
  working_dir: ".",
  projectKey: "PROJ",
  instance: "primary",
  options: {
    showAllFields: true,        // Show all custom fields, not just the 3
    filterByType: ["number", "text", "select"], // Optional filtering
    includeSystemFields: false  // Focus on custom fields only
  }
})
```

**Enhanced Output Format**:
```markdown
## All Custom Fields for Project PROJ

### Text Fields
- Customer Impact: customfield_10025 (Single line text)
- Root Cause: customfield_10030 (Multi-line text)

### Number Fields  
- Story Points: customfield_10016 (Number)
- Business Value: customfield_10040 (Number)

### Select Fields
- Priority: customfield_10020 (Single select)
- Severity: customfield_10035 (Single select)

### Agile Fields
- Sprint: customfield_10001 (Sprint)
- Epic Link: customfield_10014 (Epic Link)

## Configuration Options

### Option 1: Add All Fields
```json
"customFields": {
  "storyPoints": "customfield_10016",
  "sprint": "customfield_10001", 
  "epicLink": "customfield_10014",
  "customerImpact": "customfield_10025",
  "businessValue": "customfield_10040",
  "priority": "customfield_10020",
  "severity": "customfield_10035"
}
```

### Option 2: Add Selected Fields Only
[User can copy/paste only the fields they want]
```

### Generic Tool Interface

**Current Tool Usage (Limited)**:
```javascript
update_issue({
  working_dir: ".",
  issue_key: "PROJ-123",
  story_points: 5,           // Hardcoded parameter
  sprint: "Sprint 1",        // Hardcoded parameter  
  epic_link: "PROJ-100"      // Hardcoded parameter
})
```

**New Tool Usage (Unlimited)**:
```javascript
update_issue({
  working_dir: ".",
  issue_key: "PROJ-123",
  custom_fields: {                    // Generic parameter
    "storyPoints": 5,
    "sprint": "Sprint 1", 
    "epicLink": "PROJ-100",
    "customerPriority": "High",       // User-defined field
    "severity": "Critical",           // User-defined field
    "businessValue": 8                // User-defined field
  }
})
```

## 🏗️ Implementation Roadmap

### Phase 1: Enhanced Field Detection
**Files to Modify**:
- `src/tools/detect-project-fields.ts`

**Changes**:
- Detect ALL custom fields, not just 3 hardcoded types
- Categorize fields by type (text, number, select, etc.)
- Provide comprehensive field information with descriptions
- Allow filtering and selection options
- Generate configuration snippets for any combination of fields

**Testing**:
- Test against multiple Jira instances with different custom field setups
- Verify field type detection accuracy
- Ensure configuration snippets are correct

### Phase 2: Configuration Schema Enhancement
**Files to Modify**:
- `src/types.ts` - Add `customFields` interface
- `src/session-config.ts` - Support new configuration structure
- `src/utils/config-field-checker.ts` - Update field validation logic

**Changes**:
- Add `customFields: Record<string, string>` to project configuration
- Maintain backward compatibility with existing hardcoded fields
- Implement configuration migration/merging logic
- Update validation to support generic field mappings

**Backward Compatibility Strategy**:
```typescript
// Support both old and new configuration styles
interface ProjectConfig {
  // Legacy fields (still supported)
  storyPointsField?: string;
  sprintField?: string;
  epicLinkField?: string;
  
  // New generic fields (preferred)
  customFields?: Record<string, string>;
}

// Merge logic: customFields takes precedence
function mergeFieldConfiguration(config: ProjectConfig): Record<string, string> {
  const fields: Record<string, string> = {};
  
  // Add legacy fields
  if (config.storyPointsField) fields.storyPoints = config.storyPointsField;
  if (config.sprintField) fields.sprint = config.sprintField;
  if (config.epicLinkField) fields.epicLink = config.epicLinkField;
  
  // Override with new fields (if present)
  if (config.customFields) {
    Object.assign(fields, config.customFields);
  }
  
  return fields;
}
```

### Phase 3: Generic Tool Parameter Support
**Files to Modify**:
- All tools that currently accept custom field parameters
- `src/tools/update-issue.ts`
- `src/tools/create-issue.ts` 
- `src/tools/bulk-update-issues.ts`

**Changes**:
- Add `custom_fields?: Record<string, any>` parameter to tool schemas
- Maintain existing hardcoded parameters for backward compatibility
- Implement parameter merging logic (custom_fields takes precedence)

**Example Implementation**:
```typescript
// Tool schema update
const UpdateIssueSchema = z.object({
  // ... existing parameters
  
  // Legacy parameters (still supported)
  story_points: z.number().optional(),
  sprint: z.string().optional(),
  epic_link: z.string().optional(),
  
  // New generic parameter (preferred)
  custom_fields: z.record(z.string(), z.any()).optional()
});

// Parameter merging logic
function mergeCustomFieldParameters(args: UpdateIssueArgs): Record<string, any> {
  const fields: Record<string, any> = {};
  
  // Add legacy parameters
  if (args.story_points !== undefined) fields.storyPoints = args.story_points;
  if (args.sprint !== undefined) fields.sprint = args.sprint;
  if (args.epic_link !== undefined) fields.epicLink = args.epic_link;
  
  // Override with new parameters (if present)
  if (args.custom_fields) {
    Object.assign(fields, args.custom_fields);
  }
  
  return fields;
}
```

### Phase 4: Dynamic Field Mapping Engine
**Files to Modify**:
- `src/utils/tool-wrapper.ts` - Add field mapping utilities
- All tools using custom fields

**Changes**:
- Create generic field mapping function
- Dynamically build Jira API payloads based on configuration
- Handle field type validation and conversion
- Provide clear error messages for unmapped fields

**Implementation Example**:
```typescript
interface FieldMappingContext {
  configuredFields: Record<string, string>;  // field name -> field ID mapping
  requestedFields: Record<string, any>;      // field name -> field value mapping
}

function mapCustomFieldsToJiraPayload(context: FieldMappingContext): Record<string, any> {
  const jiraFields: Record<string, any> = {};
  
  for (const [fieldName, fieldValue] of Object.entries(context.requestedFields)) {
    const fieldId = context.configuredFields[fieldName];
    
    if (!fieldId) {
      console.warn(`Custom field '${fieldName}' not configured for this project`);
      continue; // Skip unmapped fields gracefully
    }
    
    jiraFields[fieldId] = fieldValue;
  }
  
  return jiraFields;
}

// Usage in tools
const customFieldsPayload = mapCustomFieldsToJiraPayload({
  configuredFields: projectConfig.customFields || {},
  requestedFields: mergeCustomFieldParameters(args)
});

// Merge with standard Jira fields
const updatePayload = {
  summary: args.summary,
  description: args.description,
  ...customFieldsPayload  // Dynamic custom fields
};
```

### Phase 5: Documentation and Migration
**Files to Create/Modify**:
- `CUSTOM_FIELDS_MIGRATION_GUIDE.md`
- `README.md` - Update with new generic field capabilities
- `.jira-config.json.example` - Show both old and new configuration styles
- `CLAUDE.md` - Update development guidelines

**Documentation Includes**:
- Migration guide from hardcoded to generic fields
- Best practices for field naming and organization
- Examples for common custom field scenarios
- Troubleshooting guide for field mapping issues

## 🎁 Benefits and Impact

### User Experience Benefits
- **Unlimited Field Access**: Users can configure any custom field in their Jira instance
- **Self-Service Discovery**: `detect_project_fields` shows all available options
- **Copy/Paste Configuration**: No more manual field ID hunting
- **Flexible Field Naming**: Users choose meaningful field names for their context

### Developer Experience Benefits
- **Zero Code Changes**: New custom fields require only configuration updates
- **Maintainable Architecture**: No more hardcoded field handling
- **Consistent Interface**: All custom fields work the same way
- **Better Error Messages**: Clear guidance when fields are misconfigured

### System Architecture Benefits
- **Extensibility**: System grows with user needs without code changes
- **Backward Compatibility**: Existing setups continue working unchanged
- **Configuration-Driven**: Business logic moves from code to configuration
- **Testability**: Field mapping logic is isolated and testable

## 🧪 Testing Strategy

### Unit Tests
- Field detection accuracy across different Jira instances
- Configuration parsing and merging logic
- Field mapping function with various input scenarios
- Backward compatibility with existing configurations

### Integration Tests  
- End-to-end tool usage with generic custom fields
- Multi-instance field configuration scenarios
- Error handling for misconfigured or missing fields
- Performance testing with large numbers of custom fields

### User Acceptance Testing
- New user onboarding with field discovery workflow
- Migration testing from existing hardcoded configurations
- Complex custom field scenarios (select lists, multi-value fields, etc.)

## 🔄 Migration Path for Existing Users

### Automatic Migration
```typescript
// Migration function to run during config loading
function migrateToGenericFields(oldConfig: any): any {
  if (oldConfig.customFields) {
    return oldConfig; // Already migrated
  }
  
  const newConfig = { ...oldConfig };
  
  // Convert hardcoded fields to generic mapping
  if (oldConfig.storyPointsField || oldConfig.sprintField || oldConfig.epicLinkField) {
    newConfig.customFields = {};
    
    if (oldConfig.storyPointsField) {
      newConfig.customFields.storyPoints = oldConfig.storyPointsField;
    }
    if (oldConfig.sprintField) {
      newConfig.customFields.sprint = oldConfig.sprintField;
    }
    if (oldConfig.epicLinkField) {
      newConfig.customFields.epicLink = oldConfig.epicLinkField;
    }
    
    console.log('Migrated custom fields configuration to new generic format');
  }
  
  return newConfig;
}
```

### User Communication
- Clear documentation about benefits of migration
- Examples showing before/after configuration
- Optional migration with backward compatibility
- No breaking changes to existing functionality

## 📋 Implementation Checklist

### Phase 1: Enhanced Field Detection
- [ ] Modify `detect-project-fields.ts` to detect all custom fields
- [ ] Add field categorization by type
- [ ] Implement comprehensive output formatting
- [ ] Add filtering and selection options
- [ ] Test against multiple Jira instances
- [ ] Update tool documentation

### Phase 2: Configuration Schema
- [ ] Add `customFields` interface to `types.ts`
- [ ] Update configuration loading logic
- [ ] Implement backward compatibility merging
- [ ] Update field validation utilities
- [ ] Create configuration migration function
- [ ] Test with existing and new configurations

### Phase 3: Generic Tool Parameters
- [ ] Add `custom_fields` parameter to relevant tools
- [ ] Implement parameter merging logic
- [ ] Maintain backward compatibility for existing parameters
- [ ] Update tool schemas and validation
- [ ] Test parameter precedence logic

### Phase 4: Dynamic Field Mapping
- [ ] Create generic field mapping utilities
- [ ] Update tools to use dynamic mapping
- [ ] Implement error handling for unmapped fields
- [ ] Add field type validation
- [ ] Performance testing with many fields

### Phase 5: Documentation and Testing
- [ ] Create comprehensive migration guide
- [ ] Update all documentation
- [ ] Comprehensive testing across scenarios
- [ ] User acceptance testing
- [ ] Performance and regression testing

---

**Next Steps**: This plan can be implemented incrementally, with each phase providing value while maintaining full backward compatibility. The enhancement transforms the system from "hardcoded 3-field support" to "configuration-driven unlimited field support" - a significant architectural improvement that eliminates a major limitation of the current system.