import { Button, Flex, Icon } from "metabase/ui";
import type { WritebackAction } from "metabase-types/api";

export interface RowActionConfig {
  action: WritebackAction;
  label?: string;
  icon?: string;
  variant?: "subtle" | "filled" | "light" | "outline" | "default";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export interface ActionCellProps {
  actions: RowActionConfig[];
  rowData: any[];
  rowIndex: number;
  onActionClick: (
    action: WritebackAction,
    rowData: any[],
    rowIndex: number,
  ) => void;
}

export function ActionCell({
  actions,
  rowData,
  rowIndex,
  onActionClick,
}: ActionCellProps) {
  const handleActionClick = (action: WritebackAction) => {
    // Validate inputs before calling the action
    if (!action || !action.id || !Array.isArray(rowData)) {
      console.warn("Invalid action or row data provided to ActionCell");
      return;
    }

    try {
      onActionClick(action, rowData, rowIndex);
    } catch (error) {
      console.error("Error executing row action:", error);
    }
  };

  // Validate actions array
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  // Filter out invalid actions
  const validActions = actions.filter(
    (actionConfig) =>
      actionConfig &&
      actionConfig.action &&
      actionConfig.action.id &&
      actionConfig.action.name,
  );

  if (validActions.length === 0) {
    return null;
  }

  return (
    <Flex gap="xs" align="center" justify="center">
      {validActions.map((actionConfig, index) => {
        // Icon logic
        let iconName = actionConfig.icon;
        let title = actionConfig.label || actionConfig.action.name || "";
        const lowercaseTitle = title.toLowerCase();

        if (lowercaseTitle.includes("delete")) {
          iconName = "trash";
          title = "";
        } else if (lowercaseTitle.includes("add")) {
          iconName = "plus";
          title = "";
        } else if (lowercaseTitle.includes("update")) {
          iconName = "pencil";
          title = "";
        }

        return (
          <Button
            key={`${actionConfig.action.id}-${index}`}
            variant={actionConfig.variant || "subtle"}
            size={actionConfig.size || "xs"}
            onClick={() => handleActionClick(actionConfig.action)}
            leftSection={
              iconName ? <Icon name={iconName as any} size={12} /> : null
            }
            title={title}
          >
            {title}
          </Button>
        );
      })}
    </Flex>
  );
}
