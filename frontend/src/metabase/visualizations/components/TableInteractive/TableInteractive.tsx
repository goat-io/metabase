import type {
  CellContext,
  ColumnSizingState,
  SortingState,
} from "@tanstack/react-table";
import cx from "classnames";
import type React from "react";
import {
  type Ref,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLatest } from "react-use";
import { t } from "ttag";
import _ from "underscore";

import { ErrorMessage } from "metabase/common/components/ErrorMessage";
import ExplicitSize from "metabase/common/components/ExplicitSize";
import ExternalLink from "metabase/common/components/ExternalLink";
import {
  memoize,
  useMemoizedCallback,
} from "metabase/common/hooks/use-memoized-callback";
import DashboardS from "metabase/css/dashboard.module.css";
import { DataGrid, type DataGridStylesProps } from "metabase/data-grid";
import {
  FOOTER_HEIGHT,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  ROW_ID_COLUMN_ID,
} from "metabase/data-grid/constants";
import { useDataGridInstance } from "metabase/data-grid/hooks/use-data-grid-instance";
import type {
  BodyCellVariant,
  CellFormatter,
  ColumnOptions,
  DataGridTheme,
  PlainCellFormatter,
  RowIdColumnOptions,
} from "metabase/data-grid/types";
import { withMantineTheme } from "metabase/hoc/MantineTheme";
import { useTranslateContent } from "metabase/i18n/hooks";
import { getScrollBarSize } from "metabase/lib/dom";
import { formatValue } from "metabase/lib/formatting";
import { useDispatch } from "metabase/lib/redux";
import EmbedFrameS from "metabase/public/components/EmbedFrame/EmbedFrame.module.css";
import { setUIControls } from "metabase/query_builder/actions";
import { Flex, type MantineTheme } from "metabase/ui";
import {
  getTableCellClickedObject,
  getTableClickedObjectRowData,
  getTableHeaderClickedObject,
} from "metabase/visualizations/lib/table";
import { getColumnExtent } from "metabase/visualizations/lib/utils";
import type {
  QueryClickActionsMode,
  VisualizationProps,
} from "metabase/visualizations/types";
import type { ClickObject, OrderByDirection } from "metabase-lib/types";
import type Question from "metabase-lib/v1/Question";
import { isFK, isID, isPK } from "metabase-lib/v1/types/utils/isa";
import type {
  DatasetColumn,
  RowValue,
  RowValues,
  VisualizationSettings,
  WritebackAction,
} from "metabase-types/api";

import S from "./TableInteractive.module.css";
import { ActionCell, type RowActionConfig } from "./cells/ActionCell";
import {
  HeaderCellWithColumnInfo,
  type HeaderCellWithColumnInfoProps,
} from "./cells/HeaderCellWithColumnInfo";
import { MiniBarCell } from "./cells/MiniBarCell";
import { useObjectDetail } from "./hooks/use-object-detail";
import { useResetWidthsOnColumnsChange } from "./hooks/use-reset-widths-on-columns-change";

const getBodyCellVariant = (column: DatasetColumn): BodyCellVariant => {
  const isPill = isPK(column) || isFK(column);
  if (isPill) {
    return "pill";
  }

  return "text";
};

const getColumnIndexFromPivotedColumnId = (pivotedColumnId: string) =>
  parseInt(pivotedColumnId.split(":")[1]);

interface TableProps extends VisualizationProps {
  rowIndexToPkMap?: Record<number, string>;
  isPivoted?: boolean;
  hasMetadataPopovers?: boolean;
  question: Question;
  mode: QueryClickActionsMode;
  scrollToColumn?: number;
  scrollToLastColumn?: boolean;
  theme: MantineTheme;
  renderEmptyMessage?: boolean;
  getColumnTitle: (columnIndex: number) => string;
  getColumnSortDirection: (columnIndex: number) => OrderByDirection | undefined;
  renderTableHeader: HeaderCellWithColumnInfoProps["renderTableHeader"];
  onUpdateVisualizationSettings: (settings: VisualizationSettings) => void;
  onZoomRow?: (objectId: number | string) => void;
  rowActions?: RowActionConfig[];
  onRowActionClick?: (
    action: WritebackAction,
    rowData: any[],
    rowIndex: number,
  ) => void;
}

const getColumnOrder = (
  cols: DatasetColumn[],
  hasIndexColumn: boolean,
  hasRowActionsColumn: boolean = false,
) => {
  const dataColumns = cols.map((col) => col.name);
  let baseOrder = hasIndexColumn
    ? [ROW_ID_COLUMN_ID, ...dataColumns]
    : dataColumns;
  if (hasRowActionsColumn) {
    baseOrder = ["row-actions", ...baseOrder];
  }
  return baseOrder;
};

const getColumnSizing = (
  cols: DatasetColumn[],
  widths?: number[],
): ColumnSizingState => {
  if (!widths) {
    return {};
  }

  return cols.reduce((acc: ColumnSizingState, column, index) => {
    const width = widths[index];
    if (width != null && width > 0) {
      acc[column.name] = width;
    }
    return acc;
  }, {});
};

export const TableInteractiveInner = forwardRef(function TableInteractiveInner(
  {
    className,
    data,
    series,
    height,
    settings,
    width,
    isPivoted = false,
    isNightMode,
    question,
    clicked,
    hasMetadataPopovers = true,
    mode,
    theme,
    scrollToColumn,
    renderEmptyMessage,
    queryBuilderMode,
    isDashboard,
    isSettings,
    isRawTable,
    isEmbeddingSdk,
    scrollToLastColumn,
    token,
    uuid,
    getColumnTitle,
    renderTableHeader,
    visualizationIsClickable,
    getColumnSortDirection: getServerColumnSortDirection,
    onVisualizationClick,
    onUpdateVisualizationSettings,
    rowActions,
    onRowActionClick,
  }: TableProps,
  ref: Ref<HTMLDivElement>,
) {
  const getInfoPopoversDisabledRef = useLatest(() => {
    return clicked !== null || !hasMetadataPopovers || isDashboard;
  });
  const tableTheme = theme?.other?.table;
  const dispatch = useDispatch();
  const isClientSideSortingEnabled = isDashboard;
  const isDashcardViewTable = isDashboard && !isSettings;
  const [sorting, setSorting] = useState<SortingState>([]);

  const tc = useTranslateContent();

  const { rows, cols } = data;

  const getColumnSortDirection = useMemo(() => {
    if (!isClientSideSortingEnabled) {
      return getServerColumnSortDirection;
    }

    return (columnIndex: number) => {
      const col = cols[columnIndex];
      const sortingState = sorting.find((sort) => sort.id === col.name);
      if (!sortingState) {
        return undefined;
      }
      return sortingState.desc ? "desc" : "asc";
    };
  }, [sorting, cols, isClientSideSortingEnabled, getServerColumnSortDirection]);

  // Determine if row-actions column should be present
  const hasRowActionsColumn = useMemo(() => {
    if (!rowActions || !onRowActionClick || rowActions.length === 0) {
      return false;
    }
    return rowActions.some(
      (action) =>
        action && action.action && action.action.id && action.action.name,
    );
  }, [rowActions, onRowActionClick]);

  const columnOrder = useMemo(() => {
    const CO = getColumnOrder(
      cols,
      settings["table.row_index"],
      hasRowActionsColumn,
    );
    // console.log({ CO, cols });
    return CO;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, settings["table.row_index"], hasRowActionsColumn]);

  const columnWidths = settings["table.column_widths"];
  const columnSizingMap = useMemo(() => {
    return getColumnSizing(cols, columnWidths);
  }, [cols, columnWidths]);

  const onOpenObjectDetail = useObjectDetail(data);

  const getIsCellClickable = useMemoizedCallback(
    (clicked: ClickObject) => {
      return visualizationIsClickable(clicked);
    },
    [onVisualizationClick, visualizationIsClickable],
  );

  const getCellClickedObject = useMemoizedCallback(
    (datasetColumnIndex: number, rowIndex: number) => {
      const clickedRowData = getTableClickedObjectRowData(
        series,
        rowIndex,
        datasetColumnIndex,
        isPivoted,
        data,
      );

      const clicked = getTableCellClickedObject(
        data,
        settings,
        rowIndex,
        datasetColumnIndex,
        isPivoted,
        clickedRowData,
      );

      return clicked;
    },
    [series, isPivoted, data, settings],
  );

  const columnFormatters = useMemo(() => {
    return cols.map((col) => {
      const columnSettings = settings.column?.(col);
      const columnIndex = cols.findIndex((c) => c.name === col.name);

      const rich: CellFormatter<RowValue> = memoize(
        (untranslatedValue, rowIndex) => {
          const clicked = getCellClickedObject(columnIndex, rowIndex);

          const value = tc(untranslatedValue);

          return formatValue(value, {
            ...columnSettings,
            type: "cell",
            jsx: true,
            rich: true,
            clicked,
          });
        },
      );

      const plain: PlainCellFormatter<RowValue> = memoize(
        (untranslatedValue, rowIndex) => {
          const clicked = getCellClickedObject(columnIndex, rowIndex);
          const value = tc(untranslatedValue);

          return String(
            formatValue(value, {
              ...columnSettings,
              type: "cell",
              clicked,
            }),
          );
        },
      );

      return {
        rich,
        plain,
      };
    });
  }, [cols, settings, getCellClickedObject, tc]);

  const handleBodyCellClick = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
      rowIndex: number,
      columnId: string,
    ) => {
      if (columnId === ROW_ID_COLUMN_ID) {
        if (!isDashboard) {
          onOpenObjectDetail(rowIndex);
        }
        return;
      }

      const columnIndex = isPivoted
        ? getColumnIndexFromPivotedColumnId(columnId)
        : data.cols.findIndex((col) => col.name === columnId);

      const formatter = columnFormatters[columnIndex];
      const formattedValue = formatter.rich(
        data.rows[rowIndex][columnIndex],
        rowIndex,
        columnId,
      );
      const clicked = getCellClickedObject(columnIndex, rowIndex);

      const isLink = (formattedValue as any)?.type === ExternalLink;
      if (getIsCellClickable(clicked) && !isLink) {
        onVisualizationClick?.({
          ...clicked,
          element: event.currentTarget,
        });
      }
    },
    [
      data,
      isDashboard,
      isPivoted,
      columnFormatters,
      getIsCellClickable,
      getCellClickedObject,
      onOpenObjectDetail,
      onVisualizationClick,
    ],
  );

  const handleHeaderCellClick = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
      columnId?: string,
    ) => {
      if (columnId == null) {
        return;
      }

      if (isClientSideSortingEnabled) {
        const currentSorting = sorting.find(
          (columnSorting) => columnSorting.id === columnId,
        );

        if (currentSorting == null) {
          setSorting([{ id: columnId, desc: true }]);
        } else if (currentSorting.desc) {
          setSorting((prev) =>
            prev.map((sorting) => {
              if (sorting.id === columnId) {
                return { ...sorting, desc: false };
              }
              return sorting;
            }),
          );
        } else {
          setSorting((prev) =>
            prev.filter((sorting) => sorting.id !== columnId),
          );
        }
        return;
      }

      const columnIndex = isPivoted
        ? getColumnIndexFromPivotedColumnId(columnId)
        : data.cols.findIndex((col) => col.name === columnId);

      if (columnIndex === -1) {
        return;
      }
      const newClicked = getTableHeaderClickedObject(
        data,
        columnIndex,
        isPivoted,
      );
      if (clicked?.element === event.currentTarget) {
        // Close the click actions popover after clicking on the column header the second time
        onVisualizationClick(null);
      } else {
        onVisualizationClick({ ...newClicked, element: event.currentTarget });
      }
    },
    [
      data,
      clicked,
      isPivoted,
      onVisualizationClick,
      sorting,
      isClientSideSortingEnabled,
    ],
  );

  const handleColumnReordering = useCallback(
    (columnsOrder: string[]) => {
      const newColumns = settings["table.columns"]?.slice() ?? [];

      const enabledIndices = newColumns
        .map((col, index) => (col.enabled ? index : -1))
        .filter((index) => index !== -1);

      columnsOrder.forEach((columnName, orderIndex) => {
        const sourceIndex = newColumns.findIndex(
          (col) => col.name === columnName,
        );
        if (sourceIndex !== -1) {
          const targetIndex = enabledIndices[orderIndex];

          const [column] = newColumns.splice(sourceIndex, 1);
          newColumns.splice(targetIndex, 0, column);

          if (sourceIndex > targetIndex) {
            for (let i = orderIndex + 1; i < enabledIndices.length; i++) {
              enabledIndices[i]++;
            }
          }
        }
      });

      const newEnabledColumns = newColumns.filter((col) => col.enabled);
      const savedWidths = settings["table.column_widths"];
      const newWidths =
        Array.isArray(savedWidths) &&
        savedWidths.length === newEnabledColumns.length
          ? newEnabledColumns.map((c) => columnSizingMap[c.name])
          : undefined;

      const settingsUpdate = {
        "table.columns": newColumns,
        "table.column_widths": newWidths,
      };

      onUpdateVisualizationSettings(settingsUpdate);
    },
    [onUpdateVisualizationSettings, settings, columnSizingMap],
  );

  const handleAddColumnButtonClick = useMemo(() => {
    if (
      !question ||
      !mode?.clickActions ||
      !onVisualizationClick ||
      isPivoted
    ) {
      return undefined;
    }

    for (const action of mode.clickActions) {
      const res = action({
        question,
        clicked: {
          columnShortcuts: true,
          extraData: {
            isRawTable,
          },
        },
      });
      if (res?.length > 0) {
        return (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          onVisualizationClick({
            columnShortcuts: true,
            element: e.currentTarget,
          });
        };
      }
    }
  }, [isRawTable, mode, onVisualizationClick, question, isPivoted]);

  const columnsOptions: ColumnOptions<RowValues, RowValue>[] = useMemo(() => {
    const dataColumns = cols.map((col, columnIndex) => {
      const columnSettings = settings.column?.(col) ?? {};

      const wrap =
        !settings["table.pagination"] &&
        Boolean(columnSettings["text_wrapping"]);
      const isMinibar = columnSettings["show_mini_bar"];
      const cellVariant = getBodyCellVariant(col);
      const isImage = columnSettings["view_as"] === "image";
      const headerVariant = mode != null || isDashboard ? "light" : "outline";
      const getBackgroundColor = memoize(
        (value: RowValue, rowIndex: number) =>
          settings["table._cell_background_getter"]?.(
            value,
            rowIndex,
            col.name,
          ) ?? tableTheme?.cell?.backgroundColor,
      );

      const formatter = columnFormatters[columnIndex];
      const columnName = getColumnTitle(columnIndex);

      let align;
      let id;
      let sortDirection: "asc" | "desc" | undefined;
      if (isPivoted) {
        align = columnIndex === 0 ? "right" : columnSettings["text_align"];
        id = `${col.name}:${columnIndex}`;
      } else {
        align = columnSettings["text_align"];
        id = col.name;
        sortDirection = getColumnSortDirection(columnIndex);
      }

      const translatedColumnName = tc(columnName);

      const options: ColumnOptions<RowValues, RowValue> = {
        id,
        name: translatedColumnName,
        accessorFn: (row: RowValues) => row[columnIndex],
        cellVariant,
        getCellClassName: (value) =>
          cx("test-TableInteractive-cellWrapper", {
            [S.pivotedFirstColumn]: columnIndex === 0 && isPivoted,
            [S.bodyCellWithImage]: isImage,
            "test-Table-ID": value != null && isID(col),
            "test-Table-FK": value != null && isFK(col),
            "test-TableInteractive-cellWrapper--firstColumn": columnIndex === 0,
            "test-TableInteractive-cellWrapper--lastColumn":
              columnIndex === cols.length - 1,
            "test-TableInteractive-emptyCell": value == null,
          }),
        header: () => {
          return (
            <HeaderCellWithColumnInfo
              className={cx({
                [S.pivotedFirstColumn]: columnIndex === 0 && isPivoted,
              })}
              getInfoPopoversDisabled={getInfoPopoversDisabledRef.current}
              timezone={data.results_timezone}
              question={question}
              column={col}
              name={translatedColumnName}
              align={align}
              sort={sortDirection}
              variant={headerVariant}
              columnIndex={columnIndex}
              theme={theme}
              renderTableHeader={renderTableHeader}
            />
          );
        },
        headerClickTargetSelector: "[data-header-click-target]",
        align,
        wrap,
        sortDirection,
        enableResizing: true,
        getBackgroundColor,
        formatter: formatter.rich,
        clipboardFormatter: formatter.plain,
      };

      if (isMinibar) {
        options.cell = ({
          getValue,
          row,
        }: CellContext<RowValues, RowValue>) => {
          const value = getValue();
          const backgroundColor = getBackgroundColor(value, row?.index);
          const columnExtent = getColumnExtent(cols, rows, columnIndex);

          return (
            <MiniBarCell
              rowIndex={row.index}
              columnId={id}
              align={align}
              backgroundColor={backgroundColor}
              value={value}
              formatter={formatter.rich}
              extent={columnExtent}
              columnSettings={columnSettings}
            />
          );
        };
      }

      return options;
    });

    // Add actions column if row actions are configured
    if (rowActions && rowActions.length > 0 && onRowActionClick) {
      // Validate row actions to ensure they have the required structure
      const validRowActions = rowActions.filter(
        (action) =>
          action && action.action && action.action.id && action.action.name,
      );

      if (validRowActions.length > 0) {
        const actionsColumn: ColumnOptions<RowValues, RowValue> = {
          id: "row-actions",
          name: t`Actions`,
          accessorFn: () => null,
          cellVariant: "pill",
          enableResizing: true,
          getCellClassName: () => "test-TableInteractive-actionCell",
          header: () => {
            return (
              <HeaderCellWithColumnInfo
                getInfoPopoversDisabled={() => true}
                timezone={data.results_timezone}
                question={question}
                column={{ name: "Actions", source: "native" } as DatasetColumn}
                name={t`Actions`}
                align="left"
                sort={undefined}
                variant={mode != null || isDashboard ? "light" : "outline"}
                columnIndex={-1}
                theme={theme}
                renderTableHeader={undefined}
              />
            );
          },
          align: "left" as const,
          cell: ({ row }) => {
            // Ensure row data is valid before passing to ActionCell
            if (!row || !Array.isArray(row.original)) {
              return null;
            }

            return (
              <ActionCell
                actions={validRowActions}
                rowData={row.original}
                rowIndex={row.index}
                onActionClick={onRowActionClick}
              />
            );
          },
        };
        dataColumns.unshift(actionsColumn);
      }
    }

    return dataColumns;
  }, [
    theme,
    data,
    question,
    mode,
    renderTableHeader,
    cols,
    getColumnSortDirection,
    getColumnTitle,
    columnFormatters,
    isPivoted,
    rows,
    settings,
    tableTheme,
    isDashboard,
    tc,
    getInfoPopoversDisabledRef,
    rowActions,
    onRowActionClick,
  ]);

  const handleColumnResize = useCallback(
    (columnName: string, width: number) => {
      const columnIndex = cols.findIndex((col) => col.name === columnName);
      if (columnIndex == null || isDashcardViewTable) {
        return;
      }
      const columnWidthsSetting = (
        settings["table.column_widths"] ?? []
      ).slice();

      columnWidthsSetting[columnIndex] = width;

      onUpdateVisualizationSettings({
        "table.column_widths": columnWidthsSetting,
      });
    },
    [cols, isDashcardViewTable, onUpdateVisualizationSettings, settings],
  );

  const rowId: RowIdColumnOptions | undefined = useMemo(() => {
    const getBackgroundColor = memoize((rowIndex: number) =>
      settings["table._cell_background_getter"]?.(null, rowIndex),
    );

    const hasAggregation = cols.some(
      (column) => column.source === "aggregation",
    );
    const isNotebookPreview = queryBuilderMode === "notebook";
    const isModelEditor = queryBuilderMode === "dataset";
    const hasObjectDetail =
      !(isPivoted || hasAggregation || isNotebookPreview || isModelEditor) &&
      !isEmbeddingSdk;

    const shouldShowRowIndex =
      settings["table.row_index"] && !isNotebookPreview && !isModelEditor;
    if (!hasObjectDetail && !shouldShowRowIndex) {
      return undefined;
    }

    if (isDashboard) {
      return shouldShowRowIndex
        ? {
            variant: "index",
            getBackgroundColor,
          }
        : undefined;
    }

    return {
      variant: shouldShowRowIndex ? "indexExpand" : "expandButton",
      getBackgroundColor,
    };
  }, [
    cols,
    isEmbeddingSdk,
    isPivoted,
    queryBuilderMode,
    settings,
    isDashboard,
  ]);

  const backgroundColor = useMemo(() => {
    if (!isNightMode) {
      return "transparent";
    }

    const isPublicOrStaticEmbedding = token != null || uuid != null;
    return isPublicOrStaticEmbedding
      ? "var(--mb-color-bg-black)"
      : "var(--mb-color-bg-night)";
  }, [isNightMode, token, uuid]);

  const dataGridTheme: DataGridTheme = useMemo(() => {
    return {
      stickyBackgroundColor: tableTheme.stickyBackgroundColor,
      fontSize: tableTheme.cell.fontSize,
      cell: {
        backgroundColor: tableTheme.cell.backgroundColor ?? backgroundColor,
        textColor: tableTheme.cell.textColor,
      },
      pillCell: {
        backgroundColor: tableTheme.idColumn?.backgroundColor,
        textColor: tableTheme.idColumn?.textColor,
      },
    };
  }, [tableTheme, backgroundColor]);

  const dataGridStyles: DataGridStylesProps["styles"] = useMemo(() => {
    return {
      footer: {
        color: tableTheme.cell.textColor,
      },
    };
  }, [tableTheme.cell.textColor]);

  const pageSize: number | undefined = useMemo(() => {
    if (settings["table.pagination"]) {
      const availableSpaceForRows = Math.max(
        height - (HEADER_HEIGHT + FOOTER_HEIGHT + getScrollBarSize()),
        0,
      );

      const heightBasedPageSize = Math.floor(
        availableSpaceForRows / ROW_HEIGHT,
      );

      return heightBasedPageSize > 0 ? heightBasedPageSize : undefined;
    }
    return undefined;
  }, [height, settings]);

  const minGridWidth = useMemo(() => {
    return isDashcardViewTable ? width : undefined;
  }, [isDashcardViewTable, width]);

  const tableProps = useDataGridInstance({
    data: rows,
    rowId,
    sorting,
    columnOrder,
    columnSizingMap,
    columnsOptions,
    theme: dataGridTheme,
    onColumnResize: handleColumnResize,
    onColumnReorder: handleColumnReordering,
    pageSize,
    minGridWidth,
    enableSelection: true,
  });
  const { virtualGrid } = tableProps;

  // If the data changes we reset saved column widths as it is no longer relevant
  // except for the case where question is converted from a model to a question and back.
  useResetWidthsOnColumnsChange(onUpdateVisualizationSettings, data, question);

  const scrolledColumnRef = useRef<number | null>(null);
  useEffect(() => {
    const hasColumns = virtualGrid.virtualColumns.length > 0;
    if (hasColumns && scrollToLastColumn) {
      virtualGrid.columnVirtualizer.scrollToIndex(
        tableProps.table.getAllColumns().length,
        {
          align: "end",
        },
      );
      dispatch(setUIControls({ scrollToLastColumn: false }));
    } else if (
      scrollToColumn != null &&
      scrolledColumnRef.current !== scrollToColumn
    ) {
      virtualGrid.columnVirtualizer.scrollToIndex(scrollToColumn);
      scrolledColumnRef.current = scrollToColumn;
    }
  }, [
    scrollToColumn,
    scrollToLastColumn,
    dispatch,
    tableProps.table,
    virtualGrid,
  ]);

  const handleWheel = useCallback(() => {
    if (clicked === null) {
      return;
    }

    onVisualizationClick(null);
  }, [clicked, onVisualizationClick]);

  const emptyState = useMemo(
    () =>
      renderEmptyMessage ? (
        <Flex h="100%">
          <ErrorMessage
            type="noRows"
            title={t`No results!`}
            message={t`This may be the answer you're looking for. If not, try removing or changing your filters to make them less specific.`}
            action={undefined}
          />
        </Flex>
      ) : null,
    [renderEmptyMessage],
  );

  if (!width || !height) {
    return <div ref={ref} className={className} />;
  }

  const isColumnReorderingDisabled =
    (isDashboard || mode == null || isRawTable) && !isSettings;

  return (
    <div
      ref={ref}
      className={cx(
        S.root,
        DashboardS.fullscreenNormalText,
        DashboardS.fullscreenNightText,
        EmbedFrameS.fullscreenNightText,
        className,
      )}
    >
      <DataGrid
        {...tableProps}
        styles={dataGridStyles}
        showRowsCount={isDashboard}
        isColumnReorderingDisabled={isColumnReorderingDisabled}
        emptyState={emptyState}
        onBodyCellClick={handleBodyCellClick}
        onAddColumnClick={handleAddColumnButtonClick}
        onHeaderCellClick={handleHeaderCellClick}
        onWheel={handleWheel}
      />
    </div>
  );
});

export const TableInteractive = _.compose(
  withMantineTheme,
  ExplicitSize({
    refreshMode: "throttle",
  }),
)(TableInteractiveInner);
