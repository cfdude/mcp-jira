/**
 * Archive a strategic plan (Jira Premium feature)
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface ArchivePlanArgs {
  working_dir: string;
  instance?: string;
  planId: string;
}

export async function handleArchivePlan(args: ArchivePlanArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance }) => {
      try {
        await axiosInstance.post(`/plans/plan/${toolArgs.planId}/archive`);

        return {
          content: [
            {
              type: 'text',
              text: `# Plan Archived Successfully

## ✅ Operation Complete
Plan \`${toolArgs.planId}\` has been successfully archived.

## 📋 Archive Details
- **Plan ID**: ${toolArgs.planId}
- **Archive Date**: ${new Date().toLocaleString()}
- **Status**: Archived
- **Action**: Plan moved to archived state

## 🗃️ What Archiving Means

### **Plan Status Change**
- The plan is now marked as "Archived" in the system
- It appears in archived plan listings rather than active plans
- Historical data and configuration are preserved

### **Access and Visibility**
- **Preserved Access**: Team members can still view the archived plan
- **Read-Only Mode**: No new modifications can be made to the plan structure
- **Historical Reference**: The plan serves as a historical record of completed work
- **Reporting Intact**: All historical reports and metrics remain accessible

### **Team and Issue Impact**
- **Team Assignments**: Team assignments are preserved but inactive
- **Issue Links**: All issue connections remain intact for historical tracking
- **Work History**: Complete work history and progress tracking is maintained
- **Dependencies**: Historical dependency information is preserved

## 📊 Archive Benefits

### **Clean Organization**
- Removes completed plans from active workspace views
- Improves focus on current and future planning initiatives
- Maintains organized separation between active and completed work

### **Historical Preservation**
- Provides valuable historical reference for future planning
- Preserves lessons learned and planning patterns
- Maintains audit trail for completed strategic initiatives

### **Performance Optimization**
- Reduces clutter in active plan listings and dashboards
- Improves system performance by separating active from inactive data
- Streamlines plan management workflows

## 🔍 Archived Plan Characteristics

### **What's Preserved**
- ✅ All plan configuration and settings
- ✅ Team assignments and member information
- ✅ Issue sources and connections
- ✅ Historical progress and metrics
- ✅ Scheduling and timeline data
- ✅ Custom fields and permissions
- ✅ Cross-project release information

### **What Changes**
- 🔒 Plan becomes read-only for structural changes
- 📊 Removed from active plan dashboards and views
- 🔍 Appears in archived plan listings
- ⚡ No longer included in active capacity planning
- 📈 Excluded from active progress tracking

## 💡 Post-Archive Recommendations

### **Documentation and Knowledge Transfer**
1. **Capture Lessons Learned**: Document key insights from the completed plan
2. **Share Success Patterns**: Identify successful strategies for future plans
3. **Note Improvement Areas**: Record areas for improvement in future planning
4. **Archive Related Documents**: Ensure related documentation is properly filed

### **Team Transition**
1. **Reassign Active Work**: Ensure any remaining active work is properly reassigned
2. **Update Team Assignments**: Move team members to new active plans
3. **Close Out Activities**: Complete any final administrative tasks
4. **Celebrate Achievement**: Acknowledge team accomplishments and plan completion

### **Data and Reporting**
1. **Generate Final Reports**: Create summary reports for stakeholders
2. **Archive Metrics**: Export key performance data for future reference
3. **Update Dashboards**: Remove archived plan from active monitoring dashboards
4. **Historical Analysis**: Use archived data for comparative analysis with future plans

## 🔗 Available Actions for Archived Plans

### **View Operations** (Still Available)
- \`get-plan\` - View archived plan details
- \`get-plan-teams\` - Review team assignments
- \`list-plans\` - View plan in archived section

### **Restore Options**
- **Unarchive**: Contact your Jira administrator if you need to reactivate the plan
- **Duplicate**: Use \`duplicate-plan\` to create a new plan based on this archived one
- **Reference**: Use archived plan as template for similar future initiatives

### **Not Available**
- ❌ Structural modifications (use \`update-plan\`)
- ❌ Team management (add/remove teams)
- ❌ Active capacity planning inclusion
- ❌ New issue source assignments

## 📈 Using Archived Plans for Future Planning

### **Template Source**
- Use \`duplicate-plan\` to create new plans based on successful archived plans
- Copy proven configuration patterns to new strategic initiatives
- Leverage successful team compositions and structures

### **Historical Analysis**
- Compare new plan progress against similar archived plans
- Analyze timeline patterns and capacity utilization
- Review successful scheduling and resource allocation strategies

### **Best Practice Development**
- Document successful patterns from archived plans
- Create standardized approaches based on archived plan learnings
- Develop organizational planning methodologies

## ⚠️ Important Notes
- **Irreversible Action**: Archiving cannot be undone through the API
- **Admin Assistance**: Contact your Jira administrator if you need to unarchive
- **Historical Value**: Archived plans provide valuable organizational memory
- **Future Reference**: Consider archived plans when planning similar initiatives

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
                text: `# Plan Not Found

Could not archive plan \`${toolArgs.planId}\` because it was not found. This could be due to:

## Possible Causes
- **Invalid Plan ID**: The plan \`${toolArgs.planId}\` may not exist or may have been deleted
- **Already Archived**: The plan may already be in archived status
- **Already Deleted**: The plan may have been permanently deleted
- **Plans Feature Not Available**: Plans are a Jira Premium feature and may not be enabled

## Troubleshooting Steps
1. **Verify Plan Exists**: Use \`list-plans\` to see all available plans (including archived ones)
2. **Check Plan Status**: Use \`get-plan\` to verify the plan exists and check its current status
3. **Review Plan ID**: Ensure you're using the correct plan ID
4. **Check Archives**: Look in archived plans section to see if it's already archived

## Current Plan Status Check
To understand what happened:
- Use \`list-plans\` to see all plans including archived ones
- Look for the plan in both active and archived sections
- Verify the plan ID is correct and accessible

## If Plan Was Already Archived
If the plan is already archived:
- No further action is needed
- Use \`get-plan\` to view the archived plan details
- The plan is already in the desired archived state`,
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

You don't have permission to archive plan \`${toolArgs.planId}\`. This could be due to:

## Permission Issues
- **Feature Not Enabled**: Plans are a Jira Premium feature and may not be enabled
- **Insufficient Plan Permissions**: You may not have administrative permissions for this plan
- **Archive Restrictions**: Your role may not include plan archive permissions
- **Global Permissions**: You may lack the "Administer Jira" global permission

## Required Permissions
To archive plans, you typically need:
- **Plan Edit Permissions**: Ability to modify the plan
- **Administrative Access**: Plan management permissions
- **Feature Access**: Plans feature must be enabled and accessible

## Resolution Steps
1. **Contact Plan Owner**: Ask the plan owner or administrator to archive the plan
2. **Request Permissions**: Ask your Jira administrator for plan management permissions
3. **Check Plan Ownership**: Verify if you're listed as a plan owner or administrator
4. **Feature Verification**: Confirm Plans feature is enabled and you have access

## Alternative Approaches
- Ask a plan administrator to archive the plan for you
- Request temporary administrative permissions for plan management
- Contact your organization's Jira administrators for assistance

Contact your Jira administrator if you need access to archive plans.`,
              },
            ],
          };
        }

        if (error.response?.status === 400) {
          return {
            content: [
              {
                type: 'text',
                text: `# Cannot Archive Plan

Plan \`${toolArgs.planId}\` cannot be archived at this time. This could be due to:

## Common Issues
- **Plan Already Archived**: The plan may already be in archived status
- **Active Dependencies**: The plan may have active work or dependencies that prevent archiving
- **Required Plan**: The plan may be marked as required and cannot be archived
- **Incomplete Work**: There may be incomplete work that needs resolution first

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## Pre-Archive Checklist
Before archiving a plan, consider:
1. **Complete Active Work**: Ensure all critical work is completed or reassigned
2. **Resolve Dependencies**: Address any dependencies on this plan
3. **Team Notification**: Inform team members about the plan closure
4. **Documentation**: Complete any required documentation or reporting

## Troubleshooting Steps
1. **Check Plan Status**: Use \`get-plan\` to see the current plan status
2. **Review Active Work**: Identify any incomplete or blocking work items
3. **Address Dependencies**: Resolve dependencies that may prevent archiving
4. **Contact Administrator**: Get assistance with plan closure requirements

## Alternative Actions
- Complete remaining work before archiving
- Use \`update-plan\` to resolve any blocking issues
- Contact plan stakeholders to coordinate closure`,
              },
            ],
          };
        }

        if (error.response?.status === 409) {
          return {
            content: [
              {
                type: 'text',
                text: `# Plan Archive Conflict

Plan \`${toolArgs.planId}\` cannot be archived due to a conflict. This could be due to:

## Possible Conflicts
- **Plan Already Archived**: The plan is already in archived status
- **Active Work In Progress**: Critical work items are still active and prevent archiving
- **Team Dependencies**: Other teams or plans depend on this plan
- **Concurrent Modifications**: Another user may be modifying the plan simultaneously

## Error Details
${error.response?.data?.errorMessages?.join(', ') || error.message}

## Resolution Steps
1. **Check Current Status**: Use \`get-plan\` to verify the current plan state
2. **Review Active Work**: Identify and resolve any blocking work items
3. **Coordinate with Teams**: Ensure all teams are ready for plan closure
4. **Retry Operation**: Try the archive operation again after resolving conflicts

## If Plan Is Already Archived
If the plan is already archived:
- The desired state has been achieved
- No further action is needed
- Use \`list-plans\` to confirm the plan appears in archived section`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error archiving plan: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
    session
  );
}
