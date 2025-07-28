import { createRowActionParameters } from "./row-actions";

const mockColumns = [
  { name: "id", semantic_type: "type/PK", base_type: "type/Integer" },
  { name: "name", semantic_type: null, base_type: "type/Text" },
  { name: "user_id", semantic_type: "type/FK", base_type: "type/Integer" },
];

const mockRowData = [123, "John Doe", 456];

const mockAction = {
  parameters: [
    { id: "id", name: "ID" },
    { id: "name", name: "Name" },
    { id: "user_id", name: "User ID" },
  ],
};

describe("createRowActionParameters", () => {
  it("should create parameters from row data", () => {
    const result = createRowActionParameters(mockRowData, mockColumns, 0);

    expect(result).toEqual({
      id: 123,
      ID: 123,
      Id: 123,
      name: "John Doe",
      user_id: 456,
      __row_index__: 0,
      __row_data__: mockRowData,
    });
  });

  it("should map action parameters correctly when action is provided", () => {
    const result = createRowActionParameters(
      mockRowData,
      mockColumns,
      0,
      mockAction,
    );

    expect(result).toEqual({
      id: 123,
      ID: 123,
      Id: 123,
      name: "John Doe",
      user_id: 456,
      __row_index__: 0,
      __row_data__: mockRowData,
    });
  });

  it("should handle case-insensitive parameter matching", () => {
    const actionWithUpperCase = {
      parameters: [
        { id: "ID", name: "ID" },
        { id: "NAME", name: "Name" },
      ],
    };

    const result = createRowActionParameters(
      mockRowData,
      mockColumns,
      0,
      actionWithUpperCase,
    );

    expect(result.ID).toBe(123);
    expect(result.NAME).toBe("John Doe");
  });

  it("should detect ID columns from semantic types", () => {
    const columnsWithSemanticTypes = [
      {
        name: "record_id",
        semantic_type: "type/PK",
        base_type: "type/Integer",
      },
      { name: "title", semantic_type: null, base_type: "type/Text" },
    ];
    const rowData = [789, "Test Title"];

    const result = createRowActionParameters(
      rowData,
      columnsWithSemanticTypes,
      0,
    );

    expect(result.record_id).toBe(789);
    expect(result.id).toBe(789); // Should also set common ID names
    expect(result.ID).toBe(789);
    expect(result.Id).toBe(789);
  });
});
