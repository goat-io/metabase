import { useCallback, useMemo } from "react";
import _ from "underscore";

import { getForm, getFormValidationSchema } from "metabase/actions/utils";
import type {
  ActionFormInitialValues,
  ParametersForActionExecution,
  WritebackAction,
  WritebackParameter,
} from "metabase-types/api";

import {
  formatInitialValue,
  formatSubmitValues,
  getOrGenerateFieldSettings,
} from "./utils";

type Opts = {
  action: WritebackAction;
  initialValues?: ActionFormInitialValues;
};

const INITIAL_VALUES = {};
const DEFAULT_PARAMETERS: WritebackParameter[] = [];

function useActionForm({
  action: { parameters = DEFAULT_PARAMETERS, visualization_settings },
  initialValues = INITIAL_VALUES,
}: Opts) {
  const fieldSettings = useMemo(() => {
    return getOrGenerateFieldSettings(
      parameters,
      visualization_settings?.fields,
    );
  }, [parameters, visualization_settings]);

  const form = useMemo(
    () => getForm(parameters, fieldSettings),
    [parameters, fieldSettings],
  );

  const validationSchema = useMemo(
    () => getFormValidationSchema(parameters, fieldSettings),
    [parameters, fieldSettings],
  );

  const cleanedInitialValues = useMemo(() => {
    // Start with schema-validated values
    const schemaValues = validationSchema.cast(initialValues);

    // Add any additional values from initialValues that match parameter IDs
    const enhancedValues = { ...schemaValues };

    // Match initialValues keys to parameter IDs more flexibly
    Object.keys(initialValues).forEach((key) => {
      const matchingParam = parameters.find(
        (param) =>
          param.id === key ||
          param.name === key ||
          param.id.toLowerCase() === key.toLowerCase(),
      );

      if (matchingParam && initialValues[key] != null) {
        enhancedValues[matchingParam.id] = initialValues[key];
      }
    });

    return _.mapObject(enhancedValues, (value, fieldId) => {
      const formField = fieldSettings[fieldId];

      return formatInitialValue(value, formField?.inputType);
    });
  }, [initialValues, fieldSettings, validationSchema, parameters]);

  const getCleanValues = useCallback(
    (values: ParametersForActionExecution = {}) => {
      const allValues = { ...cleanedInitialValues, ...values };
      const formatted = formatSubmitValues(allValues, fieldSettings);

      return formatted;
    },
    [cleanedInitialValues, fieldSettings],
  );

  return {
    form,
    validationSchema,
    initialValues: cleanedInitialValues,
    getCleanValues,
  };
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default useActionForm;
