import type { ComponentType } from "react";
import { useMemo } from "react";

import { executeRowAction } from "metabase/dashboard/actions/actions";
import { useDispatch } from "metabase/lib/redux";
import type { VisualizationProps } from "metabase/visualizations/types";
import type {
  ParametersForActionExecution,
  WritebackAction,
} from "metabase-types/api";

import type { RowActionConfig } from "../components/TableInteractive/cells/ActionCell";

export interface WithRowActionsProps extends VisualizationProps {
  rowActionConfigs?: RowActionConfig[];
}

export function withRowActions<P extends VisualizationProps>(
  WrappedComponent: ComponentType<P & WithRowActionsProps>,
) {
  return function WithRowActionsComponent(props: P & WithRowActionsProps) {
    const dispatch = useDispatch();
    const { rowActionConfigs, dashboard, dashcard, ...restProps } = props;

    const handleRowActionClick = useMemo(
      () =>
        async (action: WritebackAction, rowData: any[], rowIndex: number) => {
          if (!dashboard || !dashcard) {
            console.warn(
              "Dashboard or dashcard not provided for row action execution",
            );
            return;
          }

          // Create parameters from row data
          const parameters: ParametersForActionExecution = {};

          // Map row data to action parameters based on column names
          if (props.data?.cols && rowData) {
            props.data.cols.forEach((col, index) => {
              if (rowData[index] != null) {
                parameters[col.name] = rowData[index];
              }
            });
          }

          // Add row index as a special parameter
          parameters["__row_index__"] = rowIndex;

          try {
            await executeRowAction({
              dashboard,
              dashcard: {
                ...dashcard,
                action,
              },
              parameters,
              dispatch,
            });
          } catch (error) {
            console.error("Failed to execute row action:", error);
          }
        },
      [dashboard, dashcard, props.data?.cols, dispatch],
    );

    // Only pass row actions if we have the necessary context
    const enhancedProps = useMemo(() => {
      if (
        dashboard &&
        dashcard &&
        rowActionConfigs &&
        rowActionConfigs.length > 0
      ) {
        return {
          ...restProps,
          rowActions: rowActionConfigs,
          onRowActionClick: handleRowActionClick,
        };
      }
      return restProps;
    }, [
      restProps,
      dashboard,
      dashcard,
      rowActionConfigs,
      handleRowActionClick,
    ]);

    return <WrappedComponent {...(enhancedProps as P)} />;
  };
}
