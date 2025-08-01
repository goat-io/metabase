import _userEvent from "@testing-library/user-event";
import dayjs from "dayjs";

import { render, screen, within } from "__support__/ui";
import { checkNotNull } from "metabase/lib/types";
import * as Lib from "metabase-lib";

import {
  createQuery,
  createQueryWithTimeFilter,
  findTimeColumn,
} from "../test-utils";

import { TimeFilterPicker } from "./TimeFilterPicker";

const EXPECTED_OPERATORS = [
  "Before",
  "After",
  "Between",
  "Is empty",
  "Not empty",
];

const userEvent = _userEvent.setup({
  advanceTimers: jest.advanceTimersByTime,
});

const typeTime = async (input: HTMLInputElement, text: string) => {
  await userEvent.type(input, text, {
    initialSelectionStart: 0,
    initialSelectionEnd: input.value.length,
  });
};

type SetupOpts = {
  query?: Lib.Query;
  column?: Lib.ColumnMetadata;
  filter?: Lib.FilterClause;
  withAddButton?: boolean;
};

function setup({
  query = createQuery(),
  column = findTimeColumn(query),
  filter,
  withAddButton = false,
}: SetupOpts = {}) {
  const onChange = jest.fn();
  const onBack = jest.fn();

  render(
    <TimeFilterPicker
      autoFocus
      query={query}
      stageIndex={0}
      column={column}
      filter={filter}
      isNew={!filter}
      withAddButton={withAddButton}
      withSubmitButton
      onChange={onChange}
      onBack={onBack}
    />,
  );

  const getNextFilterParts = () => {
    const [filter] = onChange.mock.lastCall;
    return Lib.timeFilterParts(query, 0, filter);
  };

  const getNextFilterColumnName = () => {
    const parts = getNextFilterParts();
    const column = checkNotNull(parts?.column);
    return Lib.displayInfo(query, 0, column).longDisplayName;
  };

  const getNextFilterChangeOpts = () => {
    const [_filter, opts] = onChange.mock.lastCall;
    return opts;
  };

  return {
    query,
    column,
    getNextFilterParts,
    getNextFilterColumnName,
    getNextFilterChangeOpts,
    onChange,
    onBack,
  };
}

async function setOperator(operator: string) {
  await userEvent.click(screen.getByLabelText("Filter operator"));
  await userEvent.click(
    await screen.findByRole("menuitem", { name: operator }),
  );
}

describe("TimeFilterPicker", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 0, 1));
  });

  describe("new filter", () => {
    it("should render a blank editor", () => {
      setup();

      expect(screen.getByText("Time")).toBeInTheDocument();
      expect(screen.getByText("Before")).toBeInTheDocument();
      expect(screen.getByDisplayValue("00:00")).toBeInTheDocument();
      expect(screen.getByText("Add filter")).toBeEnabled();
    });

    it("should list operators", async () => {
      setup();

      await userEvent.click(screen.getByText("Before"));
      const menu = await screen.findByRole("menu");
      const menuItems = within(menu).getAllByRole("menuitem");

      expect(menuItems).toHaveLength(EXPECTED_OPERATORS.length);
      EXPECTED_OPERATORS.forEach((operatorName) =>
        expect(within(menu).getByText(operatorName)).toBeInTheDocument(),
      );
    });

    it("should apply a default filter", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      await userEvent.click(screen.getByText("Add filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: "<",
        column: expect.anything(),
        values: [new Date(2020, 0, 1, 0, 0)],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should add a filter with one value", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      const input = screen.getByDisplayValue("00:00") as HTMLInputElement;

      await setOperator("After");
      await typeTime(input, "11:15");
      await userEvent.click(screen.getByText("Add filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: ">",
        column: expect.anything(),
        values: [dayjs("11:15", "HH:mm").toDate()],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should add a filter with one value via keyboard", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      await setOperator("After");
      const input = screen.getByDisplayValue("00:00") as HTMLInputElement;
      await typeTime(input, "11:15{enter}");

      expect(getNextFilterParts()).toMatchObject({
        operator: ">",
        column: expect.anything(),
        values: [dayjs("11:15", "HH:mm").toDate()],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should add a filter with two values", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      await setOperator("Between");

      const [leftInput, rightInput] = screen.getAllByDisplayValue(
        "00:00",
      ) as HTMLInputElement[];
      await typeTime(leftInput, "11:15");
      await typeTime(rightInput, "12:30");
      await userEvent.click(screen.getByText("Add filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: "between",
        column: expect.anything(),
        values: [
          dayjs("11:15", "HH:mm").toDate(),
          dayjs("12:30", "HH:mm").toDate(),
        ],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should add a filter with two values via keyboard", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      await setOperator("Between");
      const [leftInput, rightInput] = screen.getAllByDisplayValue(
        "00:00",
      ) as HTMLInputElement[];
      await typeTime(leftInput, "11:15");
      await typeTime(rightInput, "12:30{enter}");

      expect(getNextFilterParts()).toMatchObject({
        operator: "between",
        column: expect.anything(),
        values: [
          dayjs("11:15", "HH:mm").toDate(),
          dayjs("12:30", "HH:mm").toDate(),
        ],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should swap values when min > max", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      await setOperator("Between");

      const [leftInput, rightInput] = screen.getAllByDisplayValue(
        "00:00",
      ) as HTMLInputElement[];
      await typeTime(leftInput, "12:30");
      await typeTime(rightInput, "11:15");
      await userEvent.click(screen.getByText("Add filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: "between",
        column: expect.anything(),
        values: [
          dayjs("11:15", "HH:mm").toDate(),
          dayjs("12:30", "HH:mm").toDate(),
        ],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should add a filter with no values", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup();

      await setOperator("Is empty");
      await userEvent.click(screen.getByText("Add filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: "is-null",
        column: expect.anything(),
        values: [],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should handle invalid input", async () => {
      const { getNextFilterParts } = setup();

      await typeTime(
        screen.getByDisplayValue("00:00") as HTMLInputElement,
        "32:71",
      );
      await userEvent.click(screen.getByText("Add filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: "<",
        column: expect.anything(),
        values: [dayjs("03:59", "HH:mm").toDate()],
      });
    });

    it("should go back", async () => {
      const { onBack, onChange } = setup();
      await userEvent.click(screen.getByLabelText("Back"));
      expect(onBack).toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      { label: "Apply filter", run: true },
      { label: "Add another filter", run: false },
    ])(
      'should add a filter via the "$label" button when the add button is enabled',
      async ({ label, run }) => {
        const { getNextFilterChangeOpts } = setup({ withAddButton: true });
        await userEvent.click(screen.getByRole("button", { name: label }));
        expect(getNextFilterChangeOpts()).toMatchObject({ run });
      },
    );
  });

  describe("existing filter", () => {
    describe("with one value", () => {
      it("should render a filter", () => {
        setup(
          createQueryWithTimeFilter({
            operator: ">",
            values: [dayjs("11:15", "HH:mm").toDate()],
          }),
        );

        expect(screen.getByText("Time")).toBeInTheDocument();
        expect(screen.getByText("After")).toBeInTheDocument();
        expect(screen.getByDisplayValue("11:15")).toBeInTheDocument();
        expect(screen.getByText("Update filter")).toBeEnabled();
      });

      it("should update a filter", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup(
          createQueryWithTimeFilter({ operator: ">" }),
        );

        await typeTime(
          screen.getByDisplayValue("00:00") as HTMLInputElement,
          "20:45",
        );
        await userEvent.click(screen.getByText("Update filter"));

        const filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: ">",
          column: expect.anything(),
          values: [dayjs("20:45", "HH:mm").toDate()],
        });
        expect(getNextFilterColumnName()).toBe("Time");
      });
    });

    describe("with two values", () => {
      it("should render a filter", () => {
        setup(
          createQueryWithTimeFilter({
            operator: "between",
            values: [
              dayjs("11:15", "HH:mm").toDate(),
              dayjs("13:00", "HH:mm").toDate(),
            ],
          }),
        );

        expect(screen.getByText("Time")).toBeInTheDocument();
        expect(screen.getByText("Between")).toBeInTheDocument();
        expect(screen.getByDisplayValue("11:15")).toBeInTheDocument();
        expect(screen.getByDisplayValue("13:00")).toBeInTheDocument();
        expect(screen.getByText("Update filter")).toBeEnabled();
      });

      it("should update a filter", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup(
          createQueryWithTimeFilter({
            operator: "between",
            values: [
              dayjs("11:15", "HH:mm").toDate(),
              dayjs("13:00", "HH:mm").toDate(),
            ],
          }),
        );

        await typeTime(
          screen.getByDisplayValue("11:15") as HTMLInputElement,
          "8:00",
        );
        await userEvent.click(screen.getByText("Update filter"));

        let filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "between",
          column: expect.anything(),
          values: [
            dayjs("08:00", "HH:mm").toDate(),
            dayjs("13:00", "HH:mm").toDate(),
          ],
        });

        await typeTime(
          screen.getByDisplayValue("13:00") as HTMLInputElement,
          "17:31",
        );
        await userEvent.click(screen.getByText("Update filter"));

        filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "between",
          column: expect.anything(),
          values: [
            dayjs("08:00", "HH:mm").toDate(),
            dayjs("17:31", "HH:mm").toDate(),
          ],
        });
        expect(getNextFilterColumnName()).toBe("Time");
      });
    });

    describe("with no values", () => {
      it("should render a filter", () => {
        setup(
          createQueryWithTimeFilter({
            operator: "not-null",
            values: [],
          }),
        );

        expect(screen.getByText("Time")).toBeInTheDocument();
        expect(screen.getByText("Not empty")).toBeInTheDocument();
        expect(screen.getByText("Update filter")).toBeEnabled();
      });

      it("should update a filter", async () => {
        const { getNextFilterParts, getNextFilterColumnName } = setup(
          createQueryWithTimeFilter({ operator: "not-null", values: [] }),
        );

        await setOperator("Is empty");
        await userEvent.click(screen.getByText("Update filter"));

        const filterParts = getNextFilterParts();
        expect(filterParts).toMatchObject({
          operator: "is-null",
          column: expect.anything(),
          values: [],
        });
        expect(getNextFilterColumnName()).toBe("Time");
      });
    });

    it("should list operators", async () => {
      setup(createQueryWithTimeFilter({ operator: "<" }));

      await userEvent.click(screen.getByText("Before"));
      const menu = await screen.findByRole("menu");
      const menuItems = within(menu).getAllByRole("menuitem");

      expect(menuItems).toHaveLength(EXPECTED_OPERATORS.length);
      EXPECTED_OPERATORS.forEach((operatorName) =>
        expect(within(menu).getByText(operatorName)).toBeInTheDocument(),
      );
    });

    it("should change an operator", async () => {
      const { getNextFilterParts, getNextFilterColumnName } = setup(
        createQueryWithTimeFilter({
          operator: "<",
          values: [dayjs("11:15", "HH:mm").toDate()],
        }),
      );

      await setOperator("After");
      await userEvent.click(screen.getByText("Update filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: ">",
        column: expect.anything(),
        values: [dayjs("11:15", "HH:mm").toDate()],
      });
      expect(getNextFilterColumnName()).toBe("Time");
    });

    it("should re-use values when changing an operator", async () => {
      setup(
        createQueryWithTimeFilter({
          operator: "between",
          values: [
            dayjs("11:15", "HH:mm").toDate(),
            dayjs("12:30", "HH:mm").toDate(),
          ],
        }),
      );
      const updateButton = screen.getByRole("button", {
        name: "Update filter",
      });

      expect(screen.getByDisplayValue("11:15")).toBeInTheDocument();
      expect(screen.getByDisplayValue("12:30")).toBeInTheDocument();

      await setOperator("Before");

      expect(screen.getByDisplayValue("11:15")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("12:30")).not.toBeInTheDocument();
      expect(updateButton).toBeEnabled();

      await setOperator("Is empty");

      expect(screen.queryByDisplayValue("11:15")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("12:30")).not.toBeInTheDocument();
      expect(updateButton).toBeEnabled();

      await setOperator("After");

      expect(screen.getByDisplayValue("00:00")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("11:15")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("12:30")).not.toBeInTheDocument();
      expect(updateButton).toBeEnabled();
    });

    it("should handle invalid filter value", async () => {
      const { getNextFilterParts } = setup(
        createQueryWithTimeFilter({
          values: [dayjs("32:66", "HH:mm").toDate()],
        }),
      );

      // There's no particular reason why 32:66 becomes 09:06
      // We trust the TimeInput to turn it into a valid time value
      const input = screen.getByDisplayValue("09:06") as HTMLInputElement;
      await typeTime(input, "11:00");
      await userEvent.click(screen.getByText("Update filter"));

      const filterParts = getNextFilterParts();
      expect(filterParts).toMatchObject({
        operator: ">",
        column: expect.anything(),
        values: [dayjs("11:00", "HH:mm").toDate()],
      });
    });

    it("should go back", async () => {
      const { onBack, onChange } = setup(
        createQueryWithTimeFilter({ operator: "<" }),
      );

      await userEvent.click(screen.getByLabelText("Back"));

      expect(onBack).toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
