import cx from "classnames";
import { Component } from "react";
import { t } from "ttag";
import _ from "underscore";

import { ActionParametersInputModal } from "metabase/actions/containers/ActionParametersInputForm";
import CS from "metabase/css/core/index.css";
import * as DataGrid from "metabase/lib/data_grid";
import { displayNameForColumn } from "metabase/lib/formatting";
import type { OptionsType } from "metabase/lib/formatting/types";
import { getSubpathSafeUrl } from "metabase/lib/urls";
import ChartSettingLinkUrlInput from "metabase/visualizations/components/settings/ChartSettingLinkUrlInput";
import {
  ChartSettingsTableFormatting,
  isFormattable,
} from "metabase/visualizations/components/settings/ChartSettingsTableFormatting";
import { createRowActionParameters } from "metabase/visualizations/lib/row-actions";
import {
  isPivoted as _isPivoted,
  columnSettings,
  getTitleForColumn,
  tableColumnSettings,
} from "metabase/visualizations/lib/settings/column";
import { getOptionFromColumn } from "metabase/visualizations/lib/settings/utils";
import { makeCellBackgroundGetter } from "metabase/visualizations/lib/table_format";
import { getDefaultPivotColumn } from "metabase/visualizations/lib/utils";
import {
  getDefaultSize,
  getMinSize,
} from "metabase/visualizations/shared/utils/sizes";
import * as Lib from "metabase-lib";
import Question from "metabase-lib/v1/Question";
import { isNative } from "metabase-lib/v1/queries/utils/card";
import { findColumnIndexesForColumnSettings } from "metabase-lib/v1/queries/utils/dataset";
import {
  isAvatarURL,
  isCoordinate,
  isDimension,
  isEmail,
  isImageURL,
  isMetric,
  isNumber,
  isString,
  isURL,
} from "metabase-lib/v1/types/utils/isa";
import type {
  DatasetColumn,
  DatasetData,
  Series,
  VisualizationSettings,
  WritebackAction,
} from "metabase-types/api";

import { TableInteractive } from "../../components/TableInteractive";
import type {
  ColumnSettingDefinition,
  ComputedVisualizationSettings,
  VisualizationProps,
} from "../../types";

interface TableProps extends VisualizationProps {
  isShowingDetailsOnlyColumns?: boolean;
  onRowActionClick?: (
    action: WritebackAction,
    rowData: any[],
    rowIndex: number,
  ) => void;
}

interface TableState {
  data: Pick<DatasetData, "cols" | "rows" | "results_timezone"> | null;
  question: Question | null;
  showActionModal: boolean;
  selectedAction: WritebackAction | null;
  selectedRowData: any[] | null;
  selectedRowIndex: number | null;
}

class Table extends Component<TableProps, TableState> {
  static getUiName = () => t`Table`;
  static identifier = "table";
  static iconName = "table2";
  static canSavePng = false;

  static minSize = getMinSize("table");
  static defaultSize = getDefaultSize("table");

  static isSensible() {
    return true;
  }

  static isLiveResizable() {
    return false;
  }

  static checkRenderable() {
    // scalar can always be rendered, nothing needed here
  }

  static isPivoted = _isPivoted;

  static settings = {
    ...columnSettings({ hidden: true }),
    "table.pagination": {
      get section() {
        return t`Columns`;
      },
      get title() {
        return t`Paginate results`;
      },
      inline: true,
      widget: "toggle",
      dashboard: true,
      default: false,
    },
    "table.row_index": {
      get section() {
        return t`Columns`;
      },
      get title() {
        return t`Show row index`;
      },
      inline: true,
      widget: "toggle",
      default: false,
    },
    "table.pivot": {
      get section() {
        return t`Columns`;
      },
      get title() {
        return t`Pivot table`;
      },
      widget: "toggle",
      inline: true,
      getHidden: (
        [{ data }]: Series,
        settings: ComputedVisualizationSettings,
      ) => data && data.cols.length !== 3 && !settings["table.pivot"],
      getDefault: ([{ card, data }]: Series) => {
        if (
          !data ||
          data.cols.length !== 3 ||
          isNative(card) ||
          data.cols.filter(isMetric).length !== 1 ||
          data.cols.filter(isDimension).length !== 2
        ) {
          return false;
        }

        return getDefaultPivotColumn(data.cols, data.rows) != null;
      },
    },

    "table.pivot_column": {
      get section() {
        return t`Columns`;
      },
      get title() {
        return t`Pivot column`;
      },
      widget: "field",
      getDefault: ([{ data }]: Series) => {
        if (!data || !data.cols || !data.rows) {
          return null;
        }
        const { cols, rows } = data;
        return getDefaultPivotColumn(cols, rows)?.name;
      },
      getProps: ([{ data }]: Series) => ({
        options: data?.cols
          ? data.cols.filter(isDimension).map(getOptionFromColumn)
          : [],
      }),
      getHidden: (series: Series, settings: VisualizationSettings) =>
        !settings["table.pivot"],
      readDependencies: ["table.pivot"],
      persistDefault: true,
    },
    "table.cell_column": {
      get section() {
        return t`Columns`;
      },
      get title() {
        return t`Cell column`;
      },
      widget: "field",
      getDefault: (
        [{ data }]: Series,
        { "table.pivot_column": pivotCol }: VisualizationSettings,
      ) => {
        if (!data || !data.cols) {
          return null;
        }
        // We try to show numeric values in pivot cells, but if none are
        // available, we fall back to the last column in the unpivoted table
        const nonPivotCols = data.cols.filter((c) => c.name !== pivotCol);
        const lastCol = nonPivotCols[nonPivotCols.length - 1];
        const { name } = nonPivotCols.find(isMetric) || lastCol || {};
        return name;
      },
      getProps: ([{ data }]: Series) => ({
        options: data?.cols ? data.cols.map(getOptionFromColumn) : [],
      }),
      getHidden: (series: Series, settings: VisualizationSettings) =>
        !settings["table.pivot"],
      readDependencies: ["table.pivot", "table.pivot_column"],
      persistDefault: true,
    },
    ...tableColumnSettings,
    "table.column_widths": {},
    [DataGrid.COLUMN_FORMATTING_SETTING]: {
      get section() {
        return t`Conditional Formatting`;
      },
      widget: ChartSettingsTableFormatting,
      default: [],
      getProps: (series: Series, settings: VisualizationSettings) => ({
        cols: (series[0]?.data?.cols || []).filter(isFormattable),
        isPivoted: settings["table.pivot"],
      }),

      getHidden: ([{ data }]: Series) =>
        !data?.cols || data.cols.filter(isFormattable).length === 0,
      readDependencies: ["table.pivot"],
    },
    "table._cell_background_getter": {
      getValue([{ data }]: Series, settings: VisualizationSettings) {
        if (!data || !data.rows || !data.cols) {
          return () => undefined;
        }
        const { rows, cols } = data;
        return makeCellBackgroundGetter(
          rows,
          cols,
          settings[DataGrid.COLUMN_FORMATTING_SETTING] ?? [],
          settings["table.pivot"],
        );
      },
      readDependencies: [DataGrid.COLUMN_FORMATTING_SETTING, "table.pivot"],
    },
    "table.row_actions": {
      get section() {
        return t`Actions`;
      },
      get title() {
        return t`Row actions`;
      },
      widget: "rowActionsSettings",
      default: [],
      getProps: (series: Series) => {
        const [{ card }] = series;
        // Check if this is a model by looking at the card type
        const isModel = card.type === "model";
        const modelId = isModel ? card.id : undefined;

        return {
          modelId,
          isModel,
        };
      },
      getHidden: (series: Series) => {
        const [{ card }] = series;
        // Only show this setting if we have a model
        return card.type !== "model";
      },
    },
  };

  static columnSettings = (column: DatasetColumn) => {
    const settings: Record<
      string,
      ColumnSettingDefinition<unknown, unknown>
    > = {
      column_title: {
        title: t`Column title`,
        widget: "input",
        getDefault: (column) => displayNameForColumn(column),
      },
      click_behavior: {},
      text_align: {
        title: t`Align`,
        widget: "select",
        getDefault: (column) => {
          const baseColumn = column?.remapped_to_column ?? column;
          return isNumber(baseColumn) || isCoordinate(baseColumn)
            ? "right"
            : "left";
        },
        props: {
          options: [
            { name: t`Left`, value: "left" },
            { name: t`Right`, value: "right" },
            { name: t`Middle`, value: "middle" },
          ],
        },
      },
    };

    if (isNumber(column)) {
      settings["show_mini_bar"] = {
        title: t`Show a mini bar chart`,
        widget: "toggle",
        inline: true,
      };
    }

    if (isString(column)) {
      const canWrapText = (columnSettings: OptionsType) =>
        columnSettings["view_as"] !== "image";

      settings["text_wrapping"] = {
        title: t`Wrap text`,
        default: false,
        widget: "toggle",
        inline: true,
        isValid: (_column, columnSettings) => {
          return canWrapText(columnSettings);
        },
        getHidden: (_column, columnSettings) => {
          return !canWrapText(columnSettings);
        },
      };
    }

    let defaultValue = !column.semantic_type || isURL(column) ? "link" : null;

    const options = [
      { name: t`Text`, value: null },
      { name: t`Link`, value: "link" },
    ];

    if (!column.semantic_type || isEmail(column)) {
      defaultValue = "email_link";
      options.push({ name: t`Email link`, value: "email_link" });
    }
    if (!column.semantic_type || isImageURL(column) || isAvatarURL(column)) {
      defaultValue = isAvatarURL(column) ? "image" : "link";
      options.push({ name: t`Image`, value: "image" });
    }
    if (!column.semantic_type) {
      defaultValue = "auto";
      options.push({ name: t`Automatic`, value: "auto" });
    }

    if (options.length > 1) {
      settings["view_as"] = {
        title: t`Display as`,
        widget: options.length === 2 ? "radio" : "select",
        default: defaultValue,
        props: {
          options,
        },
      };
    }

    const linkFieldsHint = t`You can use the value of any column here like this: {{COLUMN}}`;

    settings["link_text"] = {
      title: t`Link text`,
      widget: ChartSettingLinkUrlInput,
      hint: linkFieldsHint,
      default: null,
      getHidden: (_, settings) =>
        settings["view_as"] !== "link" && settings["view_as"] !== "email_link",
      readDependencies: ["view_as"],
      getProps: (
        column,
        settings,
        onChange,
        {
          series: [
            {
              data: { cols },
            },
          ],
        },
      ) => {
        return {
          options: cols.map((column) => column.name),
          placeholder: t`Link to {{bird_id}}`,
        };
      },
    };

    settings["link_url"] = {
      title: t`Link URL`,
      widget: ChartSettingLinkUrlInput,
      hint: linkFieldsHint,
      default: null,
      getHidden: (_, settings) => settings["view_as"] !== "link",
      readDependencies: ["view_as"],
      getProps: (
        column,
        settings,
        onChange,
        {
          series: [
            {
              data: { cols },
            },
          ],
        },
      ) => {
        return {
          options: cols.map((column) => column.name),
          placeholder: t`http://toucan.example/{{bird_id}}`,
        };
      },
    };

    return settings;
  };

  state: TableState = {
    data: null,
    question: null,
    showActionModal: false,
    selectedAction: null,
    selectedRowData: null,
    selectedRowIndex: null,
  };

  UNSAFE_componentWillMount() {
    this._updateData(this.props);
  }

  UNSAFE_componentWillReceiveProps(newProps: VisualizationProps) {
    if (
      newProps.series !== this.props.series ||
      !_.isEqual(newProps.settings, this.props.settings)
    ) {
      this._updateData(newProps);
    }
  }

  _updateData({ series, settings, metadata }: VisualizationProps) {
    const [{ card, data }] = series;
    // construct a Question that is in-sync with query results
    const question = new Question(card, metadata);

    // Handle case when data is undefined
    if (!data) {
      this.setState({
        data: null,
        question,
      });
      return;
    }

    if (Table.isPivoted(series, settings)) {
      const pivotIndex = _.findIndex(
        data.cols,
        (col) => col.name === settings["table.pivot_column"],
      );
      const cellIndex = _.findIndex(
        data.cols,
        (col) => col.name === settings["table.cell_column"],
      );
      const normalIndex = _.findIndex(
        data.cols,
        (col, index) => index !== pivotIndex && index !== cellIndex,
      );
      this.setState({
        data: DataGrid.pivot(data, normalIndex, pivotIndex, cellIndex),
        question,
      });
    } else {
      const { cols, rows, results_timezone } = data;
      const columnSettings = settings["table.columns"] ?? [];
      const columnIndexes = findColumnIndexesForColumnSettings(
        cols,
        columnSettings,
      ).filter(
        (columnIndex, settingIndex) =>
          columnIndex >= 0 &&
          (this.props.isShowingDetailsOnlyColumns ||
            (cols[columnIndex].visibility_type !== "details-only" &&
              columnSettings[settingIndex].enabled)),
      );

      this.setState({
        data: {
          cols: columnIndexes.map((i) => cols[i]),
          rows: rows.map((row) => columnIndexes.map((i) => row[i])),
          results_timezone,
        },
        question,
      });
    }
  }

  // shared helpers for table implementations

  getColumnTitle = (columnIndex: number) => {
    const cols = this.state.data && this.state.data.cols;
    if (!cols) {
      return null;
    }
    const { series, settings } = this.props;
    return getTitleForColumn(cols[columnIndex], series, settings);
  };

  getColumnSortDirection = (columnIndex: number) => {
    const { question, data } = this.state;
    if (!question || !data) {
      return;
    }

    const query = question.query();
    const stageIndex = -1;
    const column = Lib.findMatchingColumn(
      query,
      stageIndex,
      Lib.fromLegacyColumn(query, stageIndex, data.cols[columnIndex]),
      Lib.orderableColumns(query, stageIndex),
    );

    if (column != null) {
      const columnInfo = Lib.displayInfo(query, stageIndex, column);
      if (columnInfo.orderByPosition != null) {
        const orderBys = Lib.orderBys(query, stageIndex);
        const orderBy = orderBys[columnInfo.orderByPosition];
        const orderByInfo = Lib.displayInfo(query, stageIndex, orderBy);
        return orderByInfo.direction;
      }
    }
  };

  handleRowActionClick = (
    action: WritebackAction,
    rowData: any[],
    rowIndex: number,
  ) => {
    const { onRowActionClick } = this.props;

    // Validate input data
    if (!action || !Array.isArray(rowData)) {
      console.warn(
        "Invalid action or row data provided to handleRowActionClick",
      );
      return;
    }

    // If there's a custom row action handler, use it
    if (onRowActionClick) {
      try {
        onRowActionClick(action, rowData, rowIndex);
      } catch (error) {
        console.error("Error in custom row action handler:", error);
      }
      return;
    }

    // Store the action and row data, then show the action modal
    this.setState({
      showActionModal: true,
      selectedAction: action,
      selectedRowData: rowData,
      selectedRowIndex: typeof rowIndex === "number" ? rowIndex : 0,
    });
  };

  handleActionModalClose = () => {
    this.setState({
      showActionModal: false,
      selectedAction: null,
      selectedRowData: null,
      selectedRowIndex: null,
    });
  };

  handleActionSubmit = async (parameters: Record<string, any>) => {
    const { dashboard, dashcard, isDashboard } = this.props;
    const { selectedAction } = this.state;

    if (!isDashboard || !dashboard || !dashcard || !selectedAction) {
      console.warn("Row actions are only supported in dashboard context");
      return { success: false, error: "Invalid context" };
    }

    try {
      // Import executeRowAction dynamically to avoid circular dependencies
      const { executeRowAction } = await import(
        "metabase/dashboard/actions/actions"
      );
      const { getStore } = await import("metabase/store");
      const store = getStore();

      // Create a mock action dashcard for execution
      const actionDashcard = {
        ...dashcard,
        action_id: selectedAction.id,
        action: selectedAction,
      } as any;

      const result = await executeRowAction({
        dashboard,
        dashcard: actionDashcard,
        parameters,
        dispatch: store.dispatch,
      });

      if (result.success) {
        this.handleActionModalClose();
      }

      return result;
    } catch (error) {
      console.error("Failed to execute row action:", error);
      return { success: false, error };
    }
  };

  render() {
    const { series, isDashboard, settings } = this.props;
    const { data } = this.state;

    const isPivoted = Table.isPivoted(series, settings);
    const areAllColumnsHidden = data?.cols.length === 0;

    if (!data) {
      return null;
    }

    if (areAllColumnsHidden) {
      const allFieldsHiddenImageUrl = getSubpathSafeUrl(
        "app/assets/img/hidden-field.png",
      );
      const allFieldsHiddenImage2xUrl = getSubpathSafeUrl(
        "app/assets/img/hidden-field@2x.png",
      );

      return (
        <div
          className={cx(
            CS.flexFull,
            CS.px1,
            CS.pb1,
            CS.textCentered,
            CS.flex,
            CS.flexColumn,
            CS.layoutCentered,
            { [CS.textSlateLight]: isDashboard, [CS.textSlate]: !isDashboard },
          )}
        >
          <img
            data-testid="Table-all-fields-hidden-image"
            width={99}
            src={allFieldsHiddenImageUrl}
            srcSet={`
              ${allFieldsHiddenImageUrl}   1x,
              ${allFieldsHiddenImage2xUrl} 2x
            `}
            className={CS.mb2}
          />
          <span
            className={cx(CS.h4, CS.textBold)}
          >{t`Every field is hidden right now`}</span>
        </div>
      );
    }

    // Safely get row actions and validate them
    const rawRowActions = settings["table.row_actions"];
    const rowActions = Array.isArray(rawRowActions)
      ? rawRowActions.filter(
          (action) => action && action.action && action.action.id,
        )
      : [];

    return (
      <>
        <TableInteractive
          {...this.props}
          question={this.state.question}
          data={data}
          isPivoted={isPivoted}
          getColumnTitle={this.getColumnTitle}
          getColumnSortDirection={this.getColumnSortDirection}
          rowActions={rowActions}
          onRowActionClick={this.handleRowActionClick}
        />
        {this.state.showActionModal &&
          this.state.selectedAction &&
          this.state.selectedRowData &&
          data?.cols && (
            <ActionParametersInputModal
              action={this.state.selectedAction}
              title={this.state.selectedAction.name}
              showEmptyState={false}
              onClose={this.handleActionModalClose}
              onSubmit={this.handleActionSubmit}
              initialValues={createRowActionParameters(
                this.state.selectedRowData,
                data.cols,
                this.state.selectedRowIndex || 0,
                this.state.selectedAction,
              )}
            />
          )}
      </>
    );
  }
}

// eslint-disable-next-line import/no-default-export
export default Table;
