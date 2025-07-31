# Table Row Actions Feature

This feature allows you to embed actions directly into table rows, enabling users to perform operations like delete, edit, or other custom actions on individual rows.

## Overview

The row actions feature extends Metabase's table visualization to support embedding action buttons in each table row. When a user clicks an action button, the system automatically passes the row data as parameters to the underlying action.

## Architecture

### Components

1. **ActionCell** (`frontend/src/metabase/visualizations/components/TableInteractive/cells/ActionCell.tsx`)

   - Renders action buttons within table cells
   - Handles click events and passes row data to parent components

2. **TableInteractive** (modified)

   - Extended to support a new `rowActions` prop
   - Automatically adds an "Actions" column when row actions are configured
   - Handles row action execution

3. **Table** (modified)

   - Updated to pass row actions configuration to TableInteractive
   - Includes `handleRowActionClick` method for dashboard integration

4. **RowActionsSettings** (`frontend/src/metabase/visualizations/components/settings/RowActionsSettings.tsx`)
   - Configuration widget for dashboard administrators
   - Allows selection and configuration of available actions

### Configuration

Row actions are configured through table visualization settings:

```typescript
"table.row_actions": {
  section: "Actions",
  title: "Row actions",
  widget: "rowActionsSettings",
  default: [],
}
```

## Usage

### 1. Dashboard Setup

First, create actions that will be used with table rows:

1. Create a Model (table-based question)
2. Create Actions that reference the model
3. Add the table visualization to a dashboard
4. Configure row actions in the table settings

### 2. Row Action Configuration

Each row action is configured with:

```typescript
interface RowActionConfig {
  action: WritebackAction; // The actual action to execute
  label?: string; // Display label (defaults to action name)
  icon?: string; // Icon name (auto-detected from action name)
  variant?: "subtle" | "filled" | "light" | "outline" | "default";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}
```

### 3. Parameter Mapping

When a row action is executed, the system automatically creates parameters from the row data:

- Each column value is mapped to a parameter with the column name
- Special parameters are added:
  - `__row_index__`: The index of the clicked row
  - `__row_data__`: Array containing all row values

Example parameter mapping for a user table:

```javascript
// Row data: ["John Doe", "john@example.com", 25, "2023-01-01"]
// Column names: ["name", "email", "age", "created_at"]
//
// Resulting parameters:
{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 25,
  "created_at": "2023-01-01",
  "__row_index__": 0,
  "__row_data__": ["John Doe", "john@example.com", 25, "2023-01-01"]
}
```

### 4. Action Execution

Actions are executed using the existing `executeRowAction` function from the dashboard actions system. This ensures:

- Proper error handling
- Success/failure notifications
- Integration with dashboard permissions
- Support for public and embedded dashboards

## Example Implementation

### Creating a Delete Action

1. **Create the Action**:

   ```sql
   DELETE FROM users WHERE id = {{id}}
   ```

2. **Configure Table Row Actions**:

   ```typescript
   const rowActions = [
     {
       action: deleteUserAction,
       label: "Delete",
       icon: "trash",
       variant: "outline",
     },
   ];
   ```

3. **The system automatically**:
   - Adds a "Delete" button to each row
   - Maps the `id` column value to the `{{id}}` parameter
   - Executes the DELETE query when clicked
   - Shows success/error notifications

### Creating an Edit Action

1. **Create the Action**:

   ```sql
   UPDATE users
   SET name = {{name}}, email = {{email}}
   WHERE id = {{id}}
   ```

2. **The action form will pre-populate** with the current row values when opened

## Styling and Customization

### Icon Auto-Detection

The system automatically selects appropriate icons based on action names:

- Names containing "delete"/"remove" → trash icon
- Names containing "edit"/"update" → pencil icon
- Names containing "view"/"show" → eye icon
- Names containing "copy"/"duplicate" → copy icon
- Default → play icon

### Button Variants

Different visual styles are available:

- `subtle`: Minimal styling (default)
- `light`: Light background
- `outline`: Border with transparent background
- `filled`: Solid background
- `default`: Standard button appearance

## Security Considerations

- Row actions respect existing action permissions
- Users can only execute actions they have permission for
- Parameter values are validated before execution
- All actions go through the standard Metabase security pipeline

## Limitations

- Row actions are only available in dashboard context
- Actions must be pre-created before they can be used in tables
- Complex parameter mappings may require custom action configuration
- Mobile support is limited due to space constraints

## Migration and Compatibility

This feature is backward compatible:

- Existing tables continue to work without modification
- Row actions are opt-in via visualization settings
- No changes to existing action or dashboard APIs
