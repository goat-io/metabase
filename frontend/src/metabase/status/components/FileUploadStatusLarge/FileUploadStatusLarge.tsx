import { useState } from "react";
import { useInterval } from "react-use";
import { t } from "ttag";

import Button from "metabase/common/components/Button";
import Link from "metabase/common/components/Link";
import {
  isUploadAborted,
  isUploadCompleted,
  isUploadInProgress,
} from "metabase/lib/uploads";
import { PLUGIN_UPLOAD_MANAGEMENT } from "metabase/plugins";
import { Box, Stack } from "metabase/ui";
import type Table from "metabase-lib/v1/metadata/Table";
import type { Collection } from "metabase-types/api";
import { type FileUpload, UploadMode } from "metabase-types/store/upload";

import StatusLarge from "../StatusLarge";

const UPLOAD_MESSAGE_UPDATE_INTERVAL = 30 * 1000;

export interface FileUploadLargeProps {
  uploadDestination: Collection | Table;
  uploads: FileUpload[];
  resetUploads: () => void;
  isActive?: boolean;
}

const FileUploadLarge = ({
  uploadDestination,
  uploads,
  resetUploads,
  isActive,
}: FileUploadLargeProps) => {
  const [loadingTime, setLoadingTime] = useState(0);

  const hasError = uploads.some(isUploadAborted);
  const isLoading = uploads.some(isUploadInProgress);

  useInterval(
    () => {
      setLoadingTime(loadingTime + 1);
    },
    isLoading ? UPLOAD_MESSAGE_UPDATE_INTERVAL : null,
  ); // null pauses the timer

  const title =
    isLoading && loadingTime > 0
      ? getLoadingMessage(loadingTime)
      : getTitle(uploads, uploadDestination);

  const status = {
    title,
    items: uploads.map((upload) => ({
      id: upload.id,
      title: getName(upload),
      icon: "model",
      href: upload.modelId ? `/model/${upload.modelId}` : undefined,
      description: Description({ upload }),
      isInProgress: isUploadInProgress(upload),
      isCompleted: isUploadCompleted(upload),
      isAborted: isUploadAborted(upload),
    })),
  };

  if (Object.keys(uploads).length === 0) {
    return null;
  }

  return (
    <>
      <StatusLarge
        status={status}
        isActive={isActive || hasError}
        onDismiss={hasError ? resetUploads : undefined}
      />
    </>
  );
};

const getName = (upload: FileUpload) => {
  if (upload.status === "complete") {
    return <Link to={`/model/${upload.modelId}`}>{upload.name}</Link>;
  }
  return upload.name;
};

const getTitle = (
  uploads: FileUpload[],
  uploadDestination: Collection | Table,
) => {
  const isDone = uploads.every(isUploadCompleted);
  const isOnlyReplace = uploads.every(
    (upload) => upload.uploadMode === UploadMode.replace,
  );
  const isError = uploads.some(isUploadAborted);

  if (isDone) {
    if (isOnlyReplace) {
      return t`Data replaced in ${uploadDestination.name}`;
    }
    return t`Data added to ${uploadDestination.name}`;
  } else if (isError) {
    return t`Error uploading your file`;
  } else {
    return t`Uploading data to ${uploadDestination.name} …`;
  }
};

const getLoadingMessage = (time: number) => {
  const loadingMessages = [
    t`Getting our ducks in a row`,
    t`Still working`,
    t`Arranging bits and bytes`,
    t`Doing the heavy lifting`,
    t`Pushing some pixels`,
  ];

  const index = time % loadingMessages.length;
  return `${loadingMessages[index]} …`;
};

const Description = ({ upload }: { upload: FileUpload }) => {
  if (upload.status === "complete" && upload.modelId) {
    return t`Start exploring`;
  }

  if (upload.status === "error") {
    return (
      <Stack align="start" gap="xs">
        <Box>{upload.message}</Box>
        <UploadErrorDisplay upload={upload} />
      </Stack>
    );
  }
  return "";
};

const UploadErrorDisplay = ({ upload }: { upload: FileUpload }) => {
  const [showErrorModal, setShowErrorModal] = useState(true);
  if (!upload.error) {
    return null;
  }
  return (
    <>
      <Button onClick={() => setShowErrorModal(true)} onlyText>
        {t`Show error details`}
      </Button>
      {showErrorModal && (
        <PLUGIN_UPLOAD_MANAGEMENT.FileUploadErrorModal
          fileName={upload.name}
          onClose={() => setShowErrorModal(false)}
          opened={showErrorModal}
        >
          {String(upload.error)}
        </PLUGIN_UPLOAD_MANAGEMENT.FileUploadErrorModal>
      )}
    </>
  );
};

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default FileUploadLarge;
