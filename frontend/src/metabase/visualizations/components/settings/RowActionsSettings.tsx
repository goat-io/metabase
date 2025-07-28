import { t } from "ttag";

import { skipToken, useListActionsQuery } from "metabase/api";
import { colors } from "metabase/lib/colors";
import { Button, Flex, Stack, Text } from "metabase/ui";
import type { CardId, WritebackAction } from "metabase-types/api";

import type { RowActionConfig } from "../../components/TableInteractive/cells/ActionCell";

export interface RowActionsSettingsProps {
  value: RowActionConfig[];
  onChange: (value: RowActionConfig[]) => void;
  modelId?: CardId;
  isModel?: boolean;
  dashboard?: any; // Dashboard context
}

export function RowActionsSettings({
  value = [],
  onChange,
  modelId,
  isModel,
}: RowActionsSettingsProps) {
  // Fetch actions for this model
  const { data: actions = [], isLoading } = useListActionsQuery(
    modelId ? { "model-id": modelId } : skipToken,
  );

  // Filter to only non-archived actions
  const availableActions = actions.filter((action) => !action.archived);

  const handleAddAction = (action: WritebackAction) => {
    const newActionConfig: RowActionConfig = {
      action,
      label: action.name,
      icon: "play", // Default icon
      variant: "subtle",
      size: "xs",
    };
    onChange([...value, newActionConfig]);
  };

  const handleRemoveAction = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const _handleUpdateAction = (
    index: number,
    updates: Partial<RowActionConfig>,
  ) => {
    const newValue = value.map((config, i) =>
      i === index ? { ...config, ...updates } : config,
    );
    onChange(newValue);
  };

  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>
        {t`Configure actions to display in table rows`}
      </Text>

      {value.length > 0 && (
        <Stack gap="xs">
          {value.map((config, index) => (
            <Flex
              key={index}
              align="center"
              justify="space-between"
              p="sm"
              style={{
                border: `1px solid ${colors.white}`,
                borderRadius: "4px",
              }}
            >
              <Flex align="center" gap="sm">
                <Text size="sm" fw={500}>
                  {config.action.name}
                </Text>
                <Text size="xs" color="dimmed">
                  {config.label || config.action.name}
                </Text>
              </Flex>
              <Button
                variant="subtle"
                size="xs"
                color="red"
                onClick={() => handleRemoveAction(index)}
              >
                {t`Remove`}
              </Button>
            </Flex>
          ))}
        </Stack>
      )}

      {!isLoading && isModel && availableActions.length > 0 && (
        <>
          <Text size="sm" color="dimmed">
            {t`Available actions:`}
          </Text>
          <Flex gap="sm" wrap="wrap">
            {availableActions
              .filter(
                (action) =>
                  !value.some((config) => config.action.id === action.id),
              )
              .map((action) => (
                <Button
                  key={action.id}
                  variant="light"
                  size="xs"
                  onClick={() => handleAddAction(action)}
                >
                  {t`Add`} {action.name}
                </Button>
              ))}
          </Flex>
        </>
      )}

      {isLoading && (
        <Text size="sm" color="dimmed">
          {t`Loading actions...`}
        </Text>
      )}

      {!isLoading && !isModel && (
        <Text size="sm" color="dimmed">
          {t`Row actions are only available for Models. Convert this question to a Model first.`}
        </Text>
      )}

      {!isLoading && isModel && availableActions.length === 0 && (
        <Text size="sm" color="dimmed">
          {t`No actions available. Create actions for this model first.`}
        </Text>
      )}
    </Stack>
  );
}
