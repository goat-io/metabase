import { t } from "ttag";
import * as Yup from "yup";

import * as Errors from "metabase/lib/errors";
import type Field from "metabase-lib/v1/metadata/Field";
import { TYPE } from "metabase-lib/v1/types/constants";
import type {
  ActionDashboardCard,
  ActionFormOption,
  ActionFormSettings,
  BaseDashboardCard,
  Card,
  FieldSettings,
  FieldSettingsMap,
  FieldType,
  InputComponentType,
  InputSettingType,
  Parameter,
  VirtualCard,
  WritebackAction,
  WritebackActionBase,
  WritebackImplicitQueryAction,
  WritebackParameter,
} from "metabase-types/api";

import type {
  ActionFormFieldProps,
  ActionFormProps,
  FieldSettings as LocalFieldSettings,
} from "./types";

type FieldPropTypeMap = Record<InputSettingType, InputComponentType>;

const fieldPropsTypeMap: FieldPropTypeMap = {
  string: "text",
  text: "textarea",
  date: "date",
  datetime: "datetime-local",
  time: "time",
  number: "number",
  boolean: "boolean",
  select: "select",
  radio: "radio",
};

const getOptionsFromArray = (
  options: (number | string)[],
): ActionFormOption[] => options.map((o) => ({ name: o, value: o }));

function getSampleOptions(fieldType: FieldType) {
  return fieldType === "number"
    ? getOptionsFromArray([1, 2, 3])
    : getOptionsFromArray([t`Option One`, t`Option Two`, t`Option Three`]);
}

const AUTOMATIC_DATE_TIME_FIELDS = [
  TYPE.CreationDate,
  TYPE.CreationTemporal,
  TYPE.CreationTime,
  TYPE.CreationTimestamp,

  TYPE.DeletionDate,
  TYPE.DeletionTemporal,
  TYPE.DeletionTime,
  TYPE.DeletionTimestamp,

  TYPE.UpdatedDate,
  TYPE.UpdatedTemporal,
  TYPE.UpdatedTime,
  TYPE.UpdatedTimestamp,
];

const isAutomaticDateTimeField = (field: Field) => {
  return (
    field.semantic_type !== null &&
    AUTOMATIC_DATE_TIME_FIELDS.includes(field.semantic_type)
  );
};

const isEditableField = (field: Field, parameter: Parameter) => {
  const isRealField = typeof field.id === "number";
  if (!isRealField) {
    // Filters out custom, aggregated columns, etc.
    return false;
  }

  if (field.isPK()) {
    // Most of the time PKs are auto-generated,
    // but there are rare cases when they're not
    // In this case they're marked as `required`
    return parameter.required;
  }

  if (isAutomaticDateTimeField(field)) {
    return parameter.required;
  }

  return true;
};

export const inputTypeHasOptions = (inputType: InputSettingType) =>
  ["select", "radio"].includes(inputType);

export const sortActionParams =
  (formSettings: ActionFormSettings) => (a: Parameter, b: Parameter) => {
    const fields = formSettings.fields || {};

    const aOrder = fields[a.id]?.order ?? 0;
    const bOrder = fields[b.id]?.order ?? 0;

    return aOrder - bOrder;
  };

export const getDefaultFormSettings = (
  overrides: Partial<ActionFormSettings> = {},
): ActionFormSettings => ({
  name: "",
  type: "button",
  description: "",
  fields: {},
  confirmMessage: "",
  successMessage: "",
  ...overrides,
});

export const getSuccessMessage = (action: WritebackAction, result?: any) => {
  const baseMessage =
    action.visualization_settings?.successMessage ||
    t`${action.name} ran successfully`;

  // If no result or no template variables in message, return as-is
  if (!result || !baseMessage.includes("{{")) {
    return baseMessage;
  }

  // Create a context object with the result data
  const context: Record<string, any> = {};

  // Add rows data if available
  if (result.rows && result.columns) {
    // For single row results, make the values directly accessible
    if (result.rows.length === 1) {
      result.columns.forEach((col: any, index: number) => {
        context[col.name] = result.rows[0][index];
      });
    }
    // Always add the full result structure
    context.result = result;
    context.rows = result.rows;
    context.columns = result.columns;
  } else if (result["rows-affected"] !== undefined) {
    context["rows-affected"] = result["rows-affected"];
  }

  // Replace template variables {{variableName}} with values from context
  return baseMessage.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let value: any = context;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return match; // Keep original if path not found
      }
    }

    return value !== undefined && value !== null ? String(value) : match;
  });
};

export const getDefaultFieldSettings = (
  overrides: Partial<LocalFieldSettings> = {},
): FieldSettings => ({
  id: "",
  name: "",
  title: "",
  description: "",
  placeholder: "",
  order: 999,
  fieldType: "string",
  inputType: "string",
  required: true,
  hidden: false,
  width: "medium",
  ...overrides,
});

export function isSavedAction(
  action?: Partial<WritebackActionBase>,
): action is WritebackAction {
  return action != null && action.id != null;
}

export function isActionDashCard(
  dashCard: BaseDashboardCard,
): dashCard is ActionDashboardCard {
  const virtualCard = dashCard?.visualization_settings?.virtual_card;
  return isActionCard(virtualCard);
}

export const isActionCard = (card?: Card | VirtualCard) =>
  card?.display === "action";

export const getFormTitle = (action: WritebackAction): string => {
  return action.visualization_settings?.name || action.name || t`Action form`;
};

function hasDataFromExplicitAction(result: any) {
  const isInsert = result["created-row"];
  const isUpdate =
    result["rows-affected"] > 0 || result["rows-updated"]?.[0] > 0;
  const isDelete = result["rows-deleted"]?.[0] > 0;
  return !isInsert && !isUpdate && !isDelete;
}

function getImplicitActionExecutionMessage(
  action: WritebackImplicitQueryAction,
) {
  if (action.kind === "row/create") {
    return t`Successfully saved`;
  }
  if (action.kind === "row/update") {
    return t`Successfully updated`;
  }
  if (action.kind === "row/delete") {
    return t`Successfully deleted`;
  }
  return t`Successfully ran the action`;
}

export function getActionExecutionMessage(
  action: WritebackAction,
  result: any,
) {
  if (action.type === "implicit") {
    return getImplicitActionExecutionMessage(action);
  }

  // For query actions that return data, always use getSuccessMessage
  // which will interpolate the result data if template variables are present
  if (hasDataFromExplicitAction(result) || (result && result.rows)) {
    return getSuccessMessage(action, result);
  }

  return getSuccessMessage(action, result);
}

export function getActionErrorMessage(error: unknown) {
  return (
    Errors.getResponseErrorMessage(error) ??
    t`Something went wrong while executing the action`
  );
}

const getFormField = (
  parameter: Parameter,
  fieldSettings: LocalFieldSettings,
) => {
  if (fieldSettings.field && !isEditableField(fieldSettings.field, parameter)) {
    return undefined;
  }

  const fieldProps: ActionFormFieldProps = {
    name: parameter.id,
    type: fieldPropsTypeMap[fieldSettings?.inputType] ?? "text",
    title:
      fieldSettings.title ||
      fieldSettings.name ||
      parameter["display-name"] ||
      parameter.name ||
      parameter.id,
    description: fieldSettings.description ?? "",
    placeholder: fieldSettings?.placeholder,
    // fieldSettings for implicit actions contain only `hidden` and `id`
    // in this case we rely on required settings of parameter
    optional: fieldSettings.required === false || parameter.required === false,
    field: fieldSettings.field,
  };

  if (inputTypeHasOptions(fieldSettings.inputType)) {
    fieldProps.options = fieldSettings.valueOptions?.length
      ? getOptionsFromArray(fieldSettings.valueOptions)
      : getSampleOptions(fieldSettings.fieldType);
  }

  return fieldProps;
};

export const getForm = (
  parameters: WritebackParameter[] | Parameter[],
  fieldSettings: Record<string, FieldSettings> = {},
): ActionFormProps => {
  const sortedParams = [...parameters].sort(
    sortActionParams({ fields: fieldSettings } as ActionFormSettings),
  );
  return {
    fields: sortedParams
      .map((param) => getFormField(param, fieldSettings[param.id] ?? {}))
      .filter(Boolean) as ActionFormFieldProps[],
  };
};

const getFieldValidationType = ({
  inputType,
  defaultValue,
}: FieldSettings): Yup.AnySchema => {
  switch (inputType) {
    case "number":
      return Yup.number()
        .nullable()
        .default(defaultValue != null ? Number(defaultValue) : null);
    case "boolean":
      return Yup.boolean()
        .nullable()
        .default(defaultValue != null ? Boolean(defaultValue) : false);
    case "date":
    case "datetime":
    case "time":
      return Yup.string()
        .nullable()
        .default(defaultValue != null ? String(defaultValue) : null);
    default:
      return Yup.string()
        .nullable()
        .default(defaultValue != null ? String(defaultValue) : null);
  }
};

export const getFormValidationSchema = (
  parameters: WritebackParameter[] | Parameter[],
  fieldSettings: FieldSettingsMap = {},
) => {
  const schema = Object.values(fieldSettings)
    .filter((fieldSetting) =>
      // only validate fields that are present in the form
      parameters.find((parameter) => parameter.id === fieldSetting.id),
    )
    .map((fieldSetting) => {
      let yupType = getFieldValidationType(fieldSetting);

      if (fieldSetting.required) {
        yupType = yupType.required(Errors.required);
      }

      return [fieldSetting.id, yupType];
    });
  return Yup.object(Object.fromEntries(schema));
};

export const getSubmitButtonColor = (action: WritebackAction): string => {
  if (isImplicitDeleteAction(action)) {
    return "danger";
  }
  return action.visualization_settings?.submitButtonColor ?? "primary";
};

export const getSubmitButtonLabel = (action: WritebackAction): string => {
  if (action.visualization_settings?.submitButtonLabel) {
    return action.visualization_settings.submitButtonLabel;
  }

  if (action.type === "implicit") {
    if (action.kind === "row/delete") {
      return t`Delete`;
    }

    if (action.kind === "row/update") {
      return t`Update`;
    }

    if (action.kind === "row/create") {
      return t`Save`;
    }
  }

  return action.name;
};

export const isActionPublic = (action: Partial<WritebackAction>) => {
  return action.public_uuid != null;
};

export const isImplicitDeleteAction = (action: WritebackAction): boolean =>
  action.type === "implicit" && action.kind === "row/delete";

export const isImplicitUpdateAction = (action: WritebackAction): boolean =>
  action.type === "implicit" && action.kind === "row/update";
