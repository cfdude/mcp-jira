/**
 * Duplicate a strategic plan to create a new plan based on existing configuration (Jira Premium feature)
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface DuplicatePlanArgs {
  working_dir: string;
  instance?: string;
  planId: string;
  newPlanName: string;
  copyTeams?: boolean;
  copyScheduling?: boolean;
  copyExclusionRules?: boolean;
  copyCustomFields?: boolean;
  copyPermissions?: boolean;
}

export async function handleDuplicatePlan(args: DuplicatePlanArgs, _session?: SessionState) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      // Build the request body for duplication
      const requestBody: any = {
        name: toolArgs.newPlanName,
      };

      // Add optional duplication settings
      if (toolArgs.copyTeams !== undefined) {
        requestBody.copyTeams = toolArgs.copyTeams;
      }
      if (toolArgs.copyScheduling !== undefined) {
        requestBody.copyScheduling = toolArgs.copyScheduling;
      }
      if (toolArgs.copyExclusionRules !== undefined) {
        requestBody.copyExclusionRules = toolArgs.copyExclusionRules;
      }
      if (toolArgs.copyCustomFields !== undefined) {
        requestBody.copyCustomFields = toolArgs.copyCustomFields;
      }
      if (toolArgs.copyPermissions !== undefined) {
        requestBody.copyPermissions = toolArgs.copyPermissions;
      }

      const response = await axiosInstance.post(
        `/plans/plan/${toolArgs.planId}/duplicate`,
        requestBody
      );

      const newPlanId = response.data;

      // Determine what was copied based on parameters
      const getCopyStatus = (param: boolean | undefined, defaultValue: boolean = true) => {
        return param !== undefined ? param : defaultValue;
      };

      const copiedTeams = getCopyStatus(toolArgs.copyTeams);
      const copiedScheduling = getCopyStatus(toolArgs.copyScheduling);
      const copiedExclusionRules = getCopyStatus(toolArgs.copyExclusionRules);
      const copiedCustomFields = getCopyStatus(toolArgs.copyCustomFields);
      const copiedPermissions = getCopyStatus(toolArgs.copyPermissions);

      return {
        content: [
          {
            type: 'text',
            text: `# Plan Duplicated Successfully

## ✅ Operation Complete
Plan \`${toolArgs.planId}\` has been successfully duplicated to create a new plan.

## 📋 New Plan Details
- **Original Plan ID**: ${toolArgs.planId}
- **New Plan ID**: ${newPlanId}
- **New Plan Name**: ${toolArgs.newPlanName}
- **Creation Date**: ${new Date().toLocaleString()}
- **Status**: Active (new plan)

## 📄 Duplication Summary

### ✅ Always Copied
- **Basic Information**: Plan name, description structure
- **Issue Sources**: Projects, boards, and filters configuration
- **Core Structure**: Fundamental plan organization

### 🔧 Optional Components Copied
- **Teams**: ${copiedTeams ? '✅ Copied' : '❌ Not copied'}
- **Scheduling Configuration**: ${copiedScheduling ? '✅ Copied' : '❌ Not copied'}
- **Exclusion Rules**: ${copiedExclusionRules ? '✅ Copied' : '❌ Not copied'}
- **Custom Fields**: ${copiedCustomFields ? '✅ Copied' : '❌ Not copied'}
- **Permissions**: ${copiedPermissions ? '✅ Copied' : '❌ Not copied'}

## 🎯 Benefits of Plan Duplication

### **Time Savings**
- Avoids recreating complex plan configurations from scratch
- Preserves proven patterns and structures
- Accelerates new plan creation process

### **Consistency**
- Maintains organizational standards across plans
- Ensures similar projects follow established patterns
- Reduces configuration errors and inconsistencies

### **Knowledge Transfer**
- Captures successful planning patterns for reuse
- Preserves institutional knowledge about effective plan structures
- Enables replication of successful strategic approaches

## 🔄 What Happens Next

### **New Plan State**
- The new plan starts as an independent entity
- All copied configurations are editable in the new plan
- Changes to the new plan don't affect the original plan
- The new plan has its own timeline and progress tracking

### **Team Assignments**
${
  copiedTeams
    ? `- **Teams Copied**: All team assignments from the original plan are replicated
- **Independent Management**: Teams can be managed separately in each plan
- **Capacity Considerations**: Teams now contribute to both plans' capacity calculations
- **Review Recommended**: Verify team assignments are appropriate for the new plan scope`
    : `- **No Teams Copied**: The new plan starts without team assignments
- **Manual Assignment Needed**: Use \`add-plan-team\` to assign teams to the new plan
- **Fresh Start**: Allows for different team composition based on new plan requirements`
}

### **Scheduling Configuration**
${
  copiedScheduling
    ? `- **Configuration Copied**: All scheduling settings are replicated in the new plan
- **Timeline Independence**: The new plan can have its own timeline and milestones
- **Review Recommended**: Adjust dates and scheduling to match new plan objectives`
    : `- **Default Scheduling**: The new plan uses default scheduling configurations
- **Configuration Needed**: Use \`update-plan\` to set up scheduling for the new plan`
}

## 💡 Recommended Next Steps

### **Immediate Actions**
1. **Review New Plan**: Use \`get-plan\` with ID ${newPlanId} to review the duplicated configuration
2. **Adjust Timeline**: Update start and end dates for the new plan's timeline
3. **Verify Teams**: Check team assignments and adjust if needed for the new plan scope
4. **Update Description**: Modify the plan description to reflect the new plan's objectives

### **Configuration Review**
1. **Issue Sources**: Verify that copied issue sources are appropriate for the new plan
2. **Scheduling Settings**: Adjust estimation methods, dependencies, and date configurations
3. **Exclusion Rules**: Review and modify exclusion rules for the new plan's context
4. **Custom Fields**: Ensure copied custom fields are relevant to the new plan
5. **Permissions**: Verify access permissions are appropriate for new stakeholders

### **Team and Stakeholder Communication**
1. **Notify Stakeholders**: Inform relevant parties about the new plan creation
2. **Brief Team Members**: If teams were copied, brief them on the new plan objectives
3. **Update Documentation**: Create or update documentation for the new strategic initiative
4. **Set Expectations**: Clarify the new plan's scope, timeline, and deliverables

## 🔗 Management Actions for New Plan

### **Essential Setup**
- **\`get-plan ${newPlanId}\`** - Review complete configuration of new plan
- **\`update-plan ${newPlanId}\`** - Modify any settings that need adjustment
- **\`get-plan-teams ${newPlanId}\`** - Review team assignments (if copied)

### **Optional Adjustments**
- **\`add-plan-team ${newPlanId}\`** - Add additional teams if needed
- **\`remove-plan-team ${newPlanId}\`** - Remove teams that aren't needed for new plan

### **Long-term Management**
- Regular progress reviews using plan reporting tools
- Timeline adjustments as the plan progresses
- Team assignment modifications based on changing needs

## 📊 Duplication Best Practices

### **When to Duplicate Plans**
- **Similar Scope Projects**: When new initiatives have similar structure to successful past projects
- **Quarterly Planning**: Creating plans for new quarters based on previous successful patterns
- **Template Creation**: Establishing organizational standards for specific types of initiatives
- **Pilot Scaling**: Expanding successful pilot programs to larger scope

### **Duplication Considerations**
- **Team Capacity**: Consider impact on team capacity when copying team assignments
- **Resource Allocation**: Ensure adequate resources for both original and duplicated plans
- **Timeline Conflicts**: Avoid timeline conflicts between related plans
- **Scope Differentiation**: Clearly differentiate scope between original and duplicated plans

## ⚠️ Important Notes
- **Independent Plans**: The new plan is completely independent of the original
- **Resource Planning**: Consider team capacity when both plans are active simultaneously
- **Timeline Management**: Ensure timeline coordination between related plans
- **Regular Review**: Periodically review both plans to ensure they remain aligned with objectives

Plans are a Jira Premium feature requiring Advanced Roadmaps. Ensure your instance has this feature enabled and you have appropriate permissions.`,
          },
        ],
      };
    } catch (error: any) {
      // Check for specific error types
      if (error.response?.status === 404) {
        return {
          content: [
            {
              type: 'text',
              text: `# Source Plan Not Found

Could not duplicate plan \`${toolArgs.planId}\` because it was not found. This could be due to:

## Possible Causes
- **Invalid Plan ID**: The plan \`${toolArgs.planId}\` may not exist or may have been deleted
- **Archived Plan**: The plan may be archived and not available for duplication
- **Access Restrictions**: You may not have access to view the source plan
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled

## Troubleshooting Steps
1. **Verify Plan Exists**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Plan Status**: Use \`get-plan\` to verify the plan exists and is accessible
3. **Review Access**: Ensure you have permission to view the source plan
4. **Check Archives**: Verify if the plan is in archived status

## Alternative Actions
- Use \`list-plans\` to find the correct plan ID for duplication
- If the plan is archived, you may need administrator assistance to duplicate it
- Consider creating a new plan from scratch if the source plan is not available
- Use \`create-plan\` to build a new plan with similar configuration manually`,
            },
          ],
        };
      }

      if (error.response?.status === 403) {
        return {
          content: [
            {
              type: 'text',
              text: `# Access Denied

You don't have permission to duplicate plan \`${toolArgs.planId}\`. This could be due to:

## Permission Issues
- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Source Plan Access**: You may not have permission to view the source plan
- **Plan Creation Rights**: You may not have permission to create new plans
- **Global Permissions**: You may lack the "Administer Jira" global permission

## Required Permissions
To duplicate plans, you typically need:
- **View Access**: Permission to view the source plan
- **Create Permission**: Ability to create new plans
- **Feature Access**: Plans feature must be enabled and accessible

## Resolution Steps
1. **Request Source Access**: Ask for permission to view the source plan
2. **Request Creation Rights**: Ask your Jira administrator for plan creation permissions
3. **Feature Verification**: Confirm Plans feature is enabled and you have access
4. **Contact Plan Owner**: Ask the source plan owner for assistance with duplication

## Alternative Approaches
- Ask a plan administrator to duplicate the plan for you
- Request access to view the source plan configuration and recreate manually
- Use \`create-plan\` to build a similar plan from scratch

Contact your Jira administrator if you need access to duplicate plans.`,
            },
          ],
        };
      }

      if (error.response?.status === 400) {
        return {
          content: [
            {
              type: 'text',
              text: `# Invalid Duplication Request

The request to duplicate plan \`${toolArgs.planId}\` could not be processed. This could be due to:

## Common Issues
- **Invalid Plan Name**: The new plan name may be invalid or already in use
- **Invalid Parameters**: Duplication parameters may have invalid values
- **Source Plan State**: The source plan may be in a state that prevents duplication
- **System Limitations**: There may be limits on plan creation or duplication

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## Troubleshooting
1. **Check Plan Name**: Ensure the new plan name is unique and follows naming conventions
2. **Verify Parameters**: Check that all duplication parameters have valid boolean values
3. **Review Source Plan**: Use \`get-plan\` to check the source plan's current state
4. **Try Different Name**: Attempt duplication with a different plan name

## Parameter Guidelines
Duplication parameters should be boolean values:
- \`copyTeams\`: true or false
- \`copyScheduling\`: true or false
- \`copyExclusionRules\`: true or false
- \`copyCustomFields\`: true or false
- \`copyPermissions\`: true or false

## Plan Name Requirements
- Must be unique within your Jira instance
- Should follow your organization's naming conventions
- Cannot be empty or contain only whitespace
- May have length restrictions`,
            },
          ],
        };
      }

      if (error.response?.status === 409) {
        return {
          content: [
            {
              type: 'text',
              text: `# Plan Name Conflict

Plan \`${toolArgs.planId}\` cannot be duplicated because of a naming conflict. This could be due to:

## Name Conflict
- **Duplicate Name**: A plan with the name "${toolArgs.newPlanName}" already exists
- **Reserved Name**: The name may be reserved or restricted
- **Case Sensitivity**: Names may be case-sensitive and conflict with existing plans

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## Resolution Steps
1. **Choose Different Name**: Try a different name for the new plan
2. **Check Existing Plans**: Use \`list-plans\` to see all existing plan names
3. **Add Distinguishing Elements**: Include dates, versions, or other distinguishing elements
4. **Follow Naming Convention**: Use your organization's plan naming standards

## Suggested Naming Approaches
- **Add Date/Version**: "${toolArgs.newPlanName} 2024" or "${toolArgs.newPlanName} v2"
- **Add Context**: "${toolArgs.newPlanName} - Q1" or "${toolArgs.newPlanName} - Phase 2"
- **Add Team/Project**: "${toolArgs.newPlanName} - Team Alpha"
- **Sequential Numbers**: "${toolArgs.newPlanName} (Copy)" or "${toolArgs.newPlanName} #2"

Try the duplication again with a unique plan name.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error duplicating plan: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
