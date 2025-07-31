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

  it("should handle invalid input data gracefully", () => {
    // Test with null/undefined inputs
    const result1 = createRowActionParameters(null as any, mockColumns, 0);
    expect(result1).toEqual({});

    const result2 = createRowActionParameters(mockRowData, null as any, 0);
    expect(result2).toEqual({});

    // Test with empty arrays
    const result3 = createRowActionParameters([], [], 0);
    expect(result3).toEqual({
      __row_index__: 0,
      __row_data__: [],
    });
  });

  it("should serialize complex objects to strings", () => {
    const complexRowData = [
      123,
      { nested: "object" },
      [1, 2, 3],
      new Date("2023-01-01"),
    ];
    const complexColumns = [
      { name: "id", semantic_type: "type/PK", base_type: "type/Integer" },
      { name: "object_col", semantic_type: null, base_type: "type/Text" },
      { name: "array_col", semantic_type: null, base_type: "type/Text" },
      { name: "date_col", semantic_type: null, base_type: "type/DateTime" },
    ];

    const result = createRowActionParameters(complexRowData, complexColumns, 0);

    expect(result.id).toBe(123);
    expect(typeof result.object_col).toBe("string");
    expect(typeof result.array_col).toBe("string");
    expect(typeof result.date_col).toBe("string");
  });

  it("should handle invalid action parameters gracefully", () => {
    const invalidAction = {
      parameters: [
        null,
        { id: null, name: "Invalid" },
        { id: "valid_id", name: "Valid" },
      ],
    };

    const result = createRowActionParameters(
      mockRowData,
      mockColumns,
      0,
      invalidAction as any,
    );

    // Should still work with valid parameters
    expect(result.valid_id).toBeDefined();
    // Should not crash on invalid parameters
    expect(result).toBeDefined();
  });

  it("should handle non-numeric row index", () => {
    const result = createRowActionParameters(
      mockRowData,
      mockColumns,
      "invalid" as any,
    );

    expect(result.__row_index__).toBe(0); // Should default to 0
  });
});
