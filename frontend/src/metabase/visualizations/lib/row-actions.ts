import type { WritebackAction } from "metabase-types/api";

import type { RowActionConfig } from "../components/TableInteractive/cells/ActionCell";

/**
 * Utility to configure row actions for table visualizations in dashboards
 */
export function configureTableRowActions(
  availableActions: WritebackAction[],
): RowActionConfig[] {
  return availableActions.map((action) => ({
    action,
    label: action.name,
    icon: getActionIcon(action),
    variant: getActionVariant(action),
    size: "xs",
  }));
}

/**
 * Get appropriate icon for an action based on its name or type
 */
function getActionIcon(action: WritebackAction): string {
  const name = action.name.toLowerCase();

  if (name.includes("delete") || name.includes("remove")) {
    return "trash";
  }
  if (
    name.includes("edit") ||
    name.includes("update") ||
    name.includes("modify")
  ) {
    return "pencil";
  }
  if (
    name.includes("view") ||
    name.includes("show") ||
    name.includes("display")
  ) {
    return "eye";
  }
  if (name.includes("copy") || name.includes("duplicate")) {
    return "copy";
  }
  if (
    name.includes("send") ||
    name.includes("email") ||
    name.includes("notify")
  ) {
    return "mail";
  }
  if (name.includes("approve") || name.includes("accept")) {
    return "check";
  }
  if (name.includes("reject") || name.includes("deny")) {
    return "close";
  }

  // Default icon
  return "play";
}

/**
 * Get appropriate button variant for an action based on its name
 */
function getActionVariant(
  action: WritebackAction,
): "subtle" | "filled" | "light" | "outline" | "default" {
  const name = action.name.toLowerCase();

  if (name.includes("delete") || name.includes("remove")) {
    return "outline"; // More prominent for destructive actions
  }
  if (name.includes("edit") || name.includes("update")) {
    return "light";
  }

  return "subtle"; // Default to subtle for most actions
}

/**
 * Create row action parameters from table row data with automatic ID detection
 */
export function createRowActionParameters(
  rowData: any[],
  columns: {
    name: string;
    semantic_type?: string | null;
    base_type?: string | null;
  }[],
  rowIndex: number,
  action?: { parameters?: Array<{ id: string; name?: string }> },
): Record<string, any> {
  const parameters: Record<string, any> = {};

  // Ensure we have valid input data
  if (!Array.isArray(rowData) || !Array.isArray(columns)) {
    console.warn(
      "Invalid row data or columns provided to createRowActionParameters",
    );
    return parameters;
  }

  // Map column data to parameters using exact column names
  columns.forEach((col, index) => {
    if (col?.name && rowData[index] != null) {
      // Ensure parameter values are serializable
      const value = rowData[index];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        parameters[col.name] = value;
      } else {
        // Convert complex objects to strings to avoid serialization issues
        parameters[col.name] = String(value);
      }
    }
  });

  // If we have action parameter definitions, try to match columns to parameters
  if (action?.parameters && Array.isArray(action.parameters)) {
    action.parameters.forEach((actionParam) => {
      if (actionParam?.id) {
        const matchingColumnIndex = findMatchingColumn(actionParam, columns);
        if (matchingColumnIndex >= 0 && rowData[matchingColumnIndex] != null) {
          const value = rowData[matchingColumnIndex];
          // Ensure parameter values are serializable
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value === null
          ) {
            parameters[actionParam.id] = value;
          } else {
            parameters[actionParam.id] = String(value);
          }
        }
      }
    });
  }

  // Find and ensure ID fields are properly set with fallback matching
  const idColumns = findIdColumns(columns, rowData);

  idColumns.forEach(({ columnName, value, isMainId }) => {
    if (value != null && columnName) {
      // Ensure parameter values are serializable
      const serializedValue =
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
          ? value
          : String(value);

      parameters[columnName] = serializedValue;

      // Also set common ID parameter names for convenience
      if (isMainId) {
        parameters["id"] = serializedValue;
        parameters["ID"] = serializedValue;
        parameters["Id"] = serializedValue;
      }
    }
  });

  // Add special parameters (ensure they're serializable)
  parameters["__row_index__"] = typeof rowIndex === "number" ? rowIndex : 0;

  // Don't include the full row data as it may contain non-serializable objects
  // Instead, include only serializable row data
  const serializableRowData = rowData.map((value) => {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      return value;
    }
    return String(value);
  });
  parameters["__row_data__"] = serializableRowData;

  return parameters;
}

/**
 * Find ID columns in the table data
 */
function findIdColumns(
  columns: {
    name: string;
    semantic_type?: string | null;
    base_type?: string | null;
  }[],
  rowData: any[],
): Array<{ columnName: string; value: any; isMainId: boolean }> {
  const idColumns: Array<{
    columnName: string;
    value: any;
    isMainId: boolean;
  }> = [];

  columns.forEach((col, index) => {
    const value = rowData[index];
    const columnName = col.name.toLowerCase();

    // Check if this is likely an ID column
    const isPrimaryKey = col.semantic_type === "type/PK";
    const isForeignKey = col.semantic_type === "type/FK";
    const hasIdName =
      columnName === "id" ||
      columnName.endsWith("_id") ||
      columnName.endsWith("id");
    const isNumericId =
      (col.base_type === "type/Integer" ||
        col.base_type === "type/BigInteger") &&
      hasIdName;

    if (isPrimaryKey || isForeignKey || hasIdName || isNumericId) {
      idColumns.push({
        columnName: col.name,
        value,
        isMainId: isPrimaryKey || columnName === "id",
      });
    }
  });

  // If no explicit ID found, look for columns with "id" in the name
  if (idColumns.length === 0) {
    columns.forEach((col, index) => {
      const columnName = col.name.toLowerCase();
      if (columnName.includes("id")) {
        idColumns.push({
          columnName: col.name,
          value: rowData[index],
          isMainId: columnName === "id",
        });
      }
    });
  }

  return idColumns;
}

/**
 * Find a column that matches an action parameter by name or ID
 */
function findMatchingColumn(
  actionParam: { id: string; name?: string },
  columns: Array<{
    name: string;
    semantic_type?: string | null;
    base_type?: string | null;
  }>,
): number {
  // First try exact matches
  let matchIndex = columns.findIndex((col) => col.name === actionParam.id);
  if (matchIndex >= 0) {
    return matchIndex;
  }

  // Try matching with parameter name if available
  if (actionParam.name) {
    matchIndex = columns.findIndex((col) => col.name === actionParam.name);
    if (matchIndex >= 0) {
      return matchIndex;
    }
  }

  // Try case-insensitive matching
  const paramIdLower = actionParam.id.toLowerCase();
  matchIndex = columns.findIndex(
    (col) => col.name.toLowerCase() === paramIdLower,
  );
  if (matchIndex >= 0) {
    return matchIndex;
  }

  // Try matching with underscores converted to spaces or vice versa
  const paramIdUnderscore = paramIdLower.replace(/\s+/g, "_");
  const paramIdSpace = paramIdLower.replace(/_+/g, " ");

  matchIndex = columns.findIndex((col) => {
    const colNameLower = col.name.toLowerCase();
    return (
      colNameLower === paramIdUnderscore ||
      colNameLower === paramIdSpace ||
      colNameLower.replace(/\s+/g, "_") === paramIdLower ||
      colNameLower.replace(/_+/g, " ") === paramIdLower
    );
  });

  if (matchIndex >= 0) {
    return matchIndex;
  } else {
    return -1;
  }
}
