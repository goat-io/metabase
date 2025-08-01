import { useMemo } from "react";
import { msgid, ngettext, t } from "ttag";
import _ from "underscore";

import { canMoveItem, isRootTrashCollection } from "metabase/collections/utils";
import {
  BulkActionButton,
  BulkActionDangerButton,
} from "metabase/common/components/BulkActionBar";
import { ConfirmModal } from "metabase/common/components/ConfirmModal";
import { useDispatch } from "metabase/lib/redux";
import { addUndo } from "metabase/redux/undo";
import type { Collection, CollectionItem } from "metabase-types/api";

type ArchivedBulkActionsProps = {
  selected: any[];
  collection: Collection;
  selectedItems: CollectionItem[] | null;
  selectedAction: string | null;
  clearSelected: () => void;
  setSelectedItems: (items: CollectionItem[] | null) => void;
  setSelectedAction: (action: string | null) => void;
};

export const ArchivedBulkActions = ({
  selected,
  selectedItems,
  selectedAction,
  collection,
  clearSelected,
  setSelectedItems,
  setSelectedAction,
}: ArchivedBulkActionsProps) => {
  const dispatch = useDispatch();

  const hasSelectedItems = useMemo(
    () => !!selectedItems && !_.isEmpty(selectedItems),
    [selectedItems],
  );

  const selectedItemCount = selectedItems?.length ?? 0;

  const handleCloseModal = () => {
    setSelectedItems(null);
    setSelectedAction(null);
    clearSelected();
  };

  // restore
  const showRestore = isRootTrashCollection(collection);

  const canRestore = useMemo(() => {
    return selected.every((item) => item.can_restore);
  }, [selected]);

  const handleBulkRestore = () => {
    const actions = selected.map((item) => item.setArchived(false));
    Promise.all(actions).finally(() => clearSelected());
  };

  // delete
  const canDelete = useMemo(() => {
    return selected.every((item) => item.can_delete);
  }, [selected]);

  const handleBulkDeletePermanentlyStart = async () => {
    setSelectedItems(selected);
    setSelectedAction("delete");
  };

  const handleBulkDeletePermanently = async () => {
    const actions = selected.map((item) => item.delete());
    Promise.all(actions).finally(() => clearSelected());
    dispatch(
      addUndo({
        message: ngettext(
          msgid`${selected.length} item has been permanently deleted.`,
          `${selected.length} items have been permanently deleted.`,
          selected.length,
        ),
        undo: false,
        canDismiss: true,
      }),
    );
  };

  // move
  const canMove = useMemo(() => {
    return selected.every((item) => canMoveItem(item, collection));
  }, [selected, collection]);

  const handleBulkMoveStart = () => {
    setSelectedItems(selected);
    setSelectedAction("move");
  };

  return (
    <>
      {showRestore && (
        <BulkActionButton onClick={handleBulkRestore} disabled={!canRestore}>
          {t`Restore`}
        </BulkActionButton>
      )}
      <BulkActionButton onClick={handleBulkMoveStart} disabled={!canMove}>
        {t`Move`}
      </BulkActionButton>
      <BulkActionDangerButton
        onClick={handleBulkDeletePermanentlyStart}
        disabled={!canDelete}
      >
        {t`Delete permanently`}
      </BulkActionDangerButton>

      {/* This should probably be external so that we can hide
          the bar when any other modals are displayed */}
      <ConfirmModal
        opened={hasSelectedItems && selectedAction === "delete"}
        confirmButtonText={t`Delete permanently`}
        data-testid="leave-confirmation"
        message={t`This can't be undone.`}
        title={ngettext(
          msgid`Delete item permanently?`,
          `Delete ${selectedItemCount} items permanently?`,
          selectedItemCount,
        )}
        onConfirm={handleBulkDeletePermanently}
        onClose={handleCloseModal}
      />
    </>
  );
};
