import { fireEvent, render, screen } from "@testing-library/react";

import { ActionCell } from "./ActionCell";

const mockAction = {
  id: 1,
  name: "Delete User",
  description: "Delete a user from the system",
  type: "query" as const,
  model_id: 1,
  database_id: 1,
  dataset_query: {
    type: "native",
    native: {
      query: "DELETE FROM users WHERE id = {{id}}",
    },
  },
  parameters: [
    {
      id: "id",
      type: "number",
      target: ["variable", ["template-tag", "id"]],
    },
  ],
  visualization_settings: {},
};

const mockRowActionConfig = {
  action: mockAction,
  label: "Delete",
  icon: "trash",
  variant: "outline" as const,
  size: "xs" as const,
};

describe("ActionCell", () => {
  it("renders action buttons", () => {
    const mockOnActionClick = jest.fn();
    const rowData = ["John Doe", "john@example.com", 25];

    render(
      <ActionCell
        actions={[mockRowActionConfig]}
        rowData={rowData}
        rowIndex={0}
        onActionClick={mockOnActionClick}
      />,
    );

    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      "Delete a user from the system",
    );
  });

  it("calls onActionClick when button is clicked", () => {
    const mockOnActionClick = jest.fn();
    const rowData = ["John Doe", "john@example.com", 25];

    render(
      <ActionCell
        actions={[mockRowActionConfig]}
        rowData={rowData}
        rowIndex={0}
        onActionClick={mockOnActionClick}
      />,
    );

    fireEvent.click(screen.getByText("Delete"));

    expect(mockOnActionClick).toHaveBeenCalledWith(mockAction, rowData, 0);
  });

  it("renders multiple actions", () => {
    const editAction = {
      ...mockAction,
      id: 2,
      name: "Edit User",
    };

    const editConfig = {
      action: editAction,
      label: "Edit",
      icon: "pencil",
      variant: "light" as const,
      size: "xs" as const,
    };

    render(
      <ActionCell
        actions={[mockRowActionConfig, editConfig]}
        rowData={["John Doe", "john@example.com", 25]}
        rowIndex={0}
        onActionClick={jest.fn()}
      />,
    );

    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("renders nothing when no actions provided", () => {
    const { container } = render(
      <ActionCell
        actions={[]}
        rowData={[]}
        rowIndex={0}
        onActionClick={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
