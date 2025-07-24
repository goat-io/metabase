import {
  getActionErrorMessage,
  getActionExecutionMessage,
} from "metabase/actions/utils";
import { SIDEBAR_NAME } from "metabase/dashboard/constants";
import { addUndo } from "metabase/redux/undo";
import { ActionsApi, PublicApi } from "metabase/services";
import type {
  ActionDashboardCard,
  ActionFormSubmitResult,
  Dashboard,
  ParametersForActionExecution,
  WritebackAction,
} from "metabase-types/api";
import type { Dispatch } from "metabase-types/store";

import { getDashboardType } from "../utils";

import { setDashCardAttributes } from "./core";
import { closeSidebar, setSidebar } from "./ui";

type EditableActionButtonAttrs = Pick<
  ActionDashboardCard,
  "card_id" | "action" | "parameter_mappings" | "visualization_settings"
>;

export function updateButtonActionMapping(
  dashCardId: number,
  attributes: EditableActionButtonAttrs,
) {
  return (dispatch: Dispatch) => {
    dispatch(
      setDashCardAttributes({
        id: dashCardId,
        attributes: attributes,
      }),
    );
  };
}

export const parseJwt = <T>(token: string) => {
  const base64Url = token.split(".")[1];
  const base64 = base64Url?.replace(/-/g, "+").replace(/_/g, "/");

  if (!base64) {
    return undefined;
  }

  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c: any) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );

  return JSON.parse(jsonPayload) as T;
};

export type EmbedDashboardToken = {
  exp: number;
  iat: number;
  params: Record<string, string | number | boolean>;
  resource: {
    dashboard: number;
  };
};

export type ExecuteRowActionPayload = {
  dashboard: Dashboard;
  dashcard: ActionDashboardCard;
  parameters: ParametersForActionExecution;
  dispatch: Dispatch;
  shouldToast?: boolean;
};

export const executeRowAction = async ({
  dashboard,
  dashcard,
  parameters,
  dispatch,
  shouldToast = true,
}: ExecuteRowActionPayload): Promise<ActionFormSubmitResult> => {
  const dashboardType = getDashboardType(dashboard.id);

  const executeAction =
    dashboardType === "public"
      ? PublicApi.executeDashcardAction
      : ActionsApi.executeDashcardAction;

  let dashboardId = dashboard.id;
  if (dashboardType === "embed") {
    dashboardId = String(
      parseJwt<EmbedDashboardToken>(dashboard.id as string)?.resource
        ?.dashboard || "",
    );
  }

  try {
    const result = await executeAction({
      dashboardId,
      dashcardId: dashcard.id,
      modelId: dashcard.card_id,
      parameters,
    });

    const message = getActionExecutionMessage(
      dashcard.action as WritebackAction,
      result,
    );

    if (shouldToast) {
      dispatch(
        addUndo({
          toastColor: "success",
          message,
        }),
      );
    }

    return { success: true, message };
  } catch (error) {
    const message = getActionErrorMessage(error);

    if (shouldToast) {
      dispatch(
        addUndo({
          icon: "warning",
          toastColor: "error",
          message,
        }),
      );
    }

    return { success: false, error, message };
  }
};

export const setEditingDashcardId =
  (dashcardId: number | null) => (dispatch: Dispatch) => {
    if (dashcardId != null) {
      dispatch(
        setSidebar({
          name: SIDEBAR_NAME.action,
          props: {
            dashcardId,
          },
        }),
      );
    } else {
      dispatch(closeSidebar());
    }
  };
