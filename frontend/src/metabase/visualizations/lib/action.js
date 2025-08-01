import { push } from "react-router-redux";
import _ from "underscore";

import { setParameterValuesFromQueryParams } from "metabase/dashboard/actions/parameters";
import { isEmbeddingSdk } from "metabase/embedding-sdk/config";
import { open } from "metabase/lib/dom";

export function performAction(
  action,
  { dispatch, onChangeCardAndRun, onUpdateQuestion },
) {
  let didPerform = false;
  if (action.action) {
    const reduxAction = action.action();
    if (reduxAction) {
      dispatch(reduxAction);

      didPerform = true;
    }
  }
  if (action.url) {
    // (metabase#51099) disable url click behavior when in sdk
    if (isEmbeddingSdk()) {
      return true;
    }

    const url = action.url();
    const ignoreSiteUrl = action.ignoreSiteUrl;
    if (url) {
      // Hacky way to allow us to communicate from the iframe to the parent window
      if (url.startsWith("<<event>>")) {
        // Trigger event in the parent window
        const eventData = JSON.parse(url.replace("<<event>>:", ""));
        window.parent?.postMessage(
          { type: "metabase-action", data: eventData },
          "*",
        );
        return;
      }

      open(url, {
        openInSameOrigin: (location) => {
          dispatch(push(location));
          dispatch(setParameterValuesFromQueryParams(location.query));
        },
        ignoreSiteUrl,
      });
      didPerform = true;
    }
  }
  if (action.question) {
    const { questionChangeBehavior = "changeCardAndRun" } = action;

    const question = action.question();
    const extra = action?.extra?.() ?? {};

    if (question) {
      if (questionChangeBehavior === "changeCardAndRun") {
        onChangeCardAndRun({
          nextCard: question.card(),
          ...extra,
          objectId: extra.objectId,
        });
      } else if (questionChangeBehavior === "updateQuestion") {
        onUpdateQuestion(question);
      }

      didPerform = true;
    }
  }
  return didPerform;
}

export function performDefaultAction(actions, props) {
  if (!actions) {
    return false;
  }

  // "default" action if there's only one
  if (actions.length === 1 && actions[0].default) {
    return performAction(actions[0], props);
  }

  // "defaultAlways" action even if there's more than one
  const action = _.find(actions, (action) => action.defaultAlways === true);
  if (action) {
    return performAction(action, props);
  }

  return false;
}
