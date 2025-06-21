/**
 * Create custom filters for project tracking and views
 */
import { AxiosInstance } from "axios";

export async function handleCreateFilter(
  axiosInstance: AxiosInstance,
  args: any
) {
  try {
    const filterData: any = {
      name: args.name,
      description: args.description || "",
      jql: args.jql,
      favourite: args.favourite !== undefined ? args.favourite : false
    };

    // Add optional fields
    if (args.sharePermissions) {
      filterData.sharePermissions = args.sharePermissions;
    }
    if (args.editPermissions) {
      filterData.editPermissions = args.editPermissions;
    }

    const response = await axiosInstance.post(
      `/rest/api/3/filter`,
      filterData
    );

    const filter = response.data;

    // Get filter details to show what was created
    const detailsResponse = await axiosInstance.get(
      `/rest/api/3/filter/${filter.id}`,
      {
        params: { expand: "sharePermissions,editPermissions,owner,favouritedCount,subscriptions" }
      }
    );

    const filterDetails = detailsResponse.data;

    return {
      content: [
        {
          type: "text",
          text: `# Filter Created Successfully

## 🔍 Filter Details
- **Name**: ${filterDetails.name}
- **ID**: ${filterDetails.id}
- **Description**: ${filterDetails.description || "No description"}
- **JQL**: \`${filterDetails.jql}\`
- **Owner**: ${filterDetails.owner?.displayName || "Unknown"}
- **Favourite**: ${filterDetails.favourite ? "⭐ Yes" : "No"}
- **Favourited Count**: ${filterDetails.favouritedCount || 0}

## 🔗 Access Information
- **Filter URL**: ${filterDetails.viewUrl || "Not available"}
- **Search URL**: ${filterDetails.searchUrl || "Not available"}

## 🛡️ Permissions

### Share Permissions
${filterDetails.sharePermissions && filterDetails.sharePermissions.length > 0 ? 
  filterDetails.sharePermissions.map((perm: any) => 
    `- **${perm.type}**: ${perm.project?.name || perm.role?.name || perm.group?.name || "Global"}`
  ).join('\n') : 
  "No specific share permissions set (private)"
}

### Edit Permissions
${filterDetails.editPermissions && filterDetails.editPermissions.length > 0 ? 
  filterDetails.editPermissions.map((perm: any) => 
    `- **${perm.type}**: ${perm.project?.name || perm.role?.name || perm.group?.name || "Global"}`
  ).join('\n') : 
  "No specific edit permissions set (owner only)"
}

## 💡 Usage Tips
- Use this filter in dashboards and reports
- Share with team members for consistent project views
- Subscribe to get notifications about filter results
- Export results to CSV or other formats
- Create gadgets in dashboards using this filter

## 🚀 Next Steps
1. Test the filter to ensure it returns expected results
2. Consider sharing with relevant team members
3. Add to your favourites for quick access
4. Use in dashboard gadgets for project visibility

Filter is ready for use in project tracking and reporting!`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating filter: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}