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
    onActionClick(action, rowData, rowIndex);
  };

  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <Flex gap="xs" align="center" justify="center">
      {actions.map((actionConfig, index) => (
        <Button
          key={`${actionConfig.action.id}-${index}`}
          variant={actionConfig.variant || "subtle"}
          size={actionConfig.size || "xs"}
          onClick={() => handleActionClick(actionConfig.action)}
          leftSection={
            actionConfig.icon ? (
              <Icon name={actionConfig.icon as any} size={12} />
            ) : null
          }
          title={actionConfig.action.description || actionConfig.label}
        >
          {actionConfig.label || actionConfig.action.name}
        </Button>
      ))}
    </Flex>
  );
}
