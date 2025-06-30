/**
 * Move a strategic plan to trash (soft delete) (Jira Premium feature)
 */
import { withJiraContext } from "../utils/tool-wrapper.js";

interface TrashPlanArgs {
  working_dir: string;
  instance?: string;
  planId: string;
}

export async function handleTrashPlan(args: TrashPlanArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance }) => {
      try {
        const response = await axiosInstance.post(
          `/rest/api/3/plans/plan/${toolArgs.planId}/trash`
        );

        return {
          content: [
            {
              type: "text",
              text: `# Plan Moved to Trash

## ⚠️ Operation Complete
Plan \`${toolArgs.planId}\` has been moved to trash (soft deleted).

## 📋 Trash Details
- **Plan ID**: ${toolArgs.planId}
- **Trash Date**: ${new Date().toLocaleString()}
- **Status**: Moved to trash
- **Action**: Soft delete (recoverable)

## 🗑️ What "Trash" Means

### **Soft Delete**
- The plan is not permanently deleted from the system
- It's moved to a "trash" or "recycle bin" state
- The plan can potentially be restored by administrators
- All data is preserved but the plan becomes inactive

### **Immediate Effects**
- **Removed from Active Lists**: Plan no longer appears in active plan listings
- **Access Restricted**: Team members lose access to the plan interface
- **Capacity Excluded**: Plan no longer contributes to capacity planning calculations
- **Reporting Disabled**: Plan data is excluded from active reports and dashboards

### **Data Preservation**
- **Configuration Saved**: All plan settings and configuration are preserved
- **Historical Data**: Progress tracking and historical metrics are maintained
- **Team Assignments**: Team assignment records are preserved
- **Issue Connections**: Links to issues and projects remain in the system

## ⚠️ Critical Warnings

### **This Action May Be Irreversible**
- **Admin Recovery Only**: Restoration typically requires administrator intervention
- **No User Restoration**: End users cannot restore trashed plans through normal interfaces
- **Time Limitations**: There may be time limits after which restoration becomes impossible
- **Policy Dependent**: Recovery options depend on organizational data retention policies

### **Impact on Active Work**
- **Issue Assignments Remain**: Issues remain assigned to team members but lose plan context
- **Progress Tracking Lost**: Active progress tracking for the plan is discontinued
- **Team Access Removed**: Team members lose access to plan-specific views and tools
- **Reporting Gaps**: Historical reports may show gaps or incomplete data

## 🚨 Before Trashing Considerations

### **Alternative Actions**
If you're considering trashing a plan, consider these alternatives first:

1. **Archive Instead**: Use \`archive-plan\` to mark the plan as completed rather than deleting
2. **Update Status**: Use \`update-plan\` to change the plan status to "completed" or "cancelled"
3. **Remove Teams**: Use \`remove-plan-team\` to remove team assignments while keeping the plan
4. **Duplicate for Reference**: Use \`duplicate-plan\` to create a copy before trashing

### **Data Impact Assessment**
Before trashing, consider:
- **Historical Value**: Does this plan contain valuable historical data for future reference?
- **Compliance Requirements**: Are there regulatory or compliance reasons to retain the plan?
- **Lesson Learning**: Could this plan serve as a learning resource for future planning?
- **Stakeholder Impact**: Will stakeholders need access to this plan information later?

## 📊 What Happens to Plan Data

### **Immediately Unavailable**
- ❌ Plan interface and management tools
- ❌ Active progress tracking and reporting  
- ❌ Team access to plan-specific views
- ❌ Capacity planning inclusion
- ❌ Dashboard and widget display

### **Preserved (But Inaccessible)**
- ✅ Plan configuration and settings
- ✅ Team assignment history
- ✅ Issue source connections
- ✅ Historical progress data
- ✅ Custom field configurations
- ✅ Permission settings

### **Still Functional**
- ✅ Individual issue assignments to team members
- ✅ Project and board configurations
- ✅ Team structures (outside of plan context)
- ✅ Individual user access to assigned work

## 🔄 Recovery Options (Administrator Required)

### **Immediate Recovery**
If this was a mistake and you need immediate recovery:
1. **Contact Jira Administrator**: Request immediate plan restoration
2. **Provide Plan ID**: Give them the plan ID \`${toolArgs.planId}\`
3. **Explain Urgency**: Explain why immediate restoration is needed
4. **Business Justification**: Provide business reasons for restoration

### **Data Recovery Process**
Recovery typically involves:
- Administrator access to trash/recycle bin functionality
- Verification of restoration request and authorization
- Restoration of plan to active status
- Verification that all data and access are properly restored
- Notification to stakeholders about restoration

## 💡 Post-Trash Recommendations

### **Team Communication**
1. **Notify Affected Teams**: Inform all team members about the plan removal
2. **Reassign Active Work**: Ensure any active work is properly reassigned or tracked
3. **Update Documentation**: Remove references to the trashed plan from active documentation
4. **Stakeholder Communication**: Notify stakeholders about the plan status change

### **Data Management**
1. **Export Key Data**: If possible, export any critical data before it becomes inaccessible
2. **Update Related Plans**: Remove dependencies on the trashed plan from other active plans
3. **Clean Up References**: Remove links and references to the trashed plan from other systems
4. **Archive Documentation**: Move plan-related documentation to appropriate archives

### **Process Improvement**
1. **Document Lessons**: Capture lessons learned from the plan before losing access
2. **Review Process**: Consider what led to the need to trash the plan
3. **Improve Planning**: Use insights to improve future planning processes
4. **Update Standards**: Update organizational planning standards if needed

## 🚫 Actions No Longer Available

After trashing, these operations are no longer possible:
- ❌ \`get-plan\` - Plan details retrieval
- ❌ \`update-plan\` - Plan modifications
- ❌ \`get-plan-teams\` - Team information access
- ❌ \`add-plan-team\` / \`remove-plan-team\` - Team management
- ❌ \`archive-plan\` - Status changes
- ❌ \`duplicate-plan\` - Plan duplication

## 🔗 Related Actions Still Available

- **\`list-plans\`** - Will no longer show this plan in active lists
- **\`create-plan\`** - Create new plans to replace functionality
- **Issue Management** - Individual issue management continues normally
- **Team Management** - Team management outside of plan context

## ⚠️ Final Warning
This action moves the plan to trash and may be difficult or impossible to reverse without administrator intervention. Ensure you have:
- ✅ Backed up any critical data
- ✅ Notified all stakeholders
- ✅ Considered alternatives like archiving
- ✅ Reassigned any active work
- ✅ Documented lessons learned

Plans are a Jira Premium feature requiring Advanced Roadmaps. Trash functionality depends on your instance configuration and may vary.`,
            },
          ],
        };
      } catch (error: any) {
        // Check for specific error types
        if (error.response?.status === 404) {
          return {
            content: [
              {
                type: "text",
                text: `# Plan Not Found

Could not move plan \`${toolArgs.planId}\` to trash because it was not found. This could be due to:

## Possible Causes
- **Invalid Plan ID**: The plan \`${toolArgs.planId}\` may not exist or may have been deleted
- **Already Trashed**: The plan may already be in trash status
- **Already Deleted**: The plan may have been permanently deleted
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled

## Troubleshooting Steps
1. **Verify Plan Exists**: Use \`list-plans\` to see all available plans and their IDs
2. **Check Plan Status**: Use \`get-plan\` to verify the plan exists and check its current status
3. **Review Plan ID**: Ensure you're using the correct plan ID
4. **Check Trash Status**: The plan may already be trashed

## Current Plan Status Check
To understand what happened:
- Use \`list-plans\` to see all active and archived plans
- Look for the plan in active, archived, or potentially trashed sections
- Verify the plan ID is correct and matches an existing plan

## If Plan Was Already Trashed
If the plan is already trashed:
- No further action is needed
- The plan is already in the desired trashed state
- Contact your administrator if you need to verify trash status`,
              },
            ],
          };
        }

        if (error.response?.status === 403) {
          return {
            content: [
              {
                type: "text",
                text: `# Access Denied

You don't have permission to move plan \`${toolArgs.planId}\` to trash. This could be due to:

## Permission Issues
- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Plan Permissions**: You may not have administrative permissions for this plan
- **Delete Restrictions**: Your role may not include plan deletion permissions
- **Global Permissions**: You may lack the "Administer Jira" global permission

## Required Permissions
To trash plans, you typically need:
- **Plan Administrative Rights**: Full administrative access to the plan
- **Delete Permissions**: Specific permission to delete or trash plans
- **Feature Access**: Plans feature must be enabled and accessible

## Resolution Steps
1. **Contact Plan Owner**: Ask the plan owner or administrator to trash the plan
2. **Request Permissions**: Ask your Jira administrator for plan deletion permissions
3. **Check Plan Ownership**: Verify if you're listed as a plan owner or administrator
4. **Feature Verification**: Confirm Plans feature is enabled and you have access

## Alternative Approaches
- Ask a plan administrator to trash the plan for you
- Use \`archive-plan\` if you have archive permissions instead of delete permissions
- Request temporary administrative permissions for plan management

## Important Note
Plan deletion/trashing is typically restricted to prevent accidental data loss. The permission restrictions are designed to protect valuable strategic planning data.

Contact your Jira administrator if you need access to trash plans.`,
              },
            ],
          };
        }

        if (error.response?.status === 400) {
          return {
            content: [
              {
                type: "text",
                text: `# Cannot Trash Plan

Plan \`${toolArgs.planId}\` cannot be moved to trash at this time. This could be due to:

## Common Issues
- **Plan Already Trashed**: The plan may already be in trash status
- **Active Dependencies**: The plan may have active dependencies that prevent deletion
- **Required Plan**: The plan may be marked as required and cannot be deleted
- **System Restrictions**: There may be system-level restrictions preventing deletion

## Error Details
${error.response?.data?.errorMessages?.join(", ") || error.message}

## Pre-Deletion Checklist
Before trashing a plan, consider:
1. **Complete Active Work**: Ensure all critical work is completed or reassigned
2. **Resolve Dependencies**: Address any dependencies on this plan from other systems
3. **Team Notification**: Inform team members about the plan removal
4. **Data Backup**: Export any critical data that may be needed later

## Troubleshooting Steps
1. **Check Plan Status**: Use \`get-plan\` to see the current plan status and state
2. **Review Dependencies**: Identify any active dependencies that may prevent deletion
3. **Address Blocking Issues**: Resolve any issues that prevent the deletion
4. **Contact Administrator**: Get assistance with plan deletion requirements

## Alternative Actions
- Use \`archive-plan\` instead of trashing if the plan is complete
- Use \`update-plan\` to change plan status without deleting
- Complete or reassign active work before attempting to trash
- Contact plan stakeholders to coordinate proper closure`,
              },
            ],
          };
        }

        if (error.response?.status === 409) {
          return {
            content: [
              {
                type: "text",
                text: `# Plan Trash Conflict

Plan \`${toolArgs.planId}\` cannot be moved to trash due to a conflict. This could be due to:

## Possible Conflicts
- **Plan Already Trashed**: The plan is already in trash status
- **Concurrent Operations**: Another user may be modifying the plan simultaneously
- **Active Work Dependencies**: Critical work items prevent the plan from being trashed
- **System State Conflict**: The plan state conflicts with trash operation requirements

## Error Details
${error.response?.data?.errorMessages?.join(", ") || error.message}

## Resolution Steps
1. **Check Current Status**: Use \`get-plan\` to verify the current plan state
2. **Wait and Retry**: If there's a concurrent operation, wait and try again
3. **Resolve Dependencies**: Address any active work or dependencies that prevent trashing
4. **Coordinate with Teams**: Ensure all teams are ready for plan removal

## If Plan Is Already Trashed
If the plan is already trashed:
- The desired state has been achieved
- No further action is needed
- Contact your administrator if you need to verify trash status or need restoration`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error moving plan to trash: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}