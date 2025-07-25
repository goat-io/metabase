const { H } = cy;

const questionDetails = {
  name: "Return input value",
  native: {
    query: "select {{filter}}",
    "template-tags": {
      filter: {
        id: "7182a24e-163a-099c-b085-156f0879aaec",
        name: "filter",
        "display-name": "Filter",
        type: "text",
        required: true,
        default: "Foo",
      },
    },
  },
  display: "scalar",
};

const filter = {
  name: "Text",
  slug: "text",
  id: "904aa8b7",
  type: "string/=",
  sectionId: "string",
  default: "Bar",
};

const dashboardDetails = {
  name: "Required Filters Dashboard",
  parameters: [filter],
};

describe("scenarios > dashboard > filters > SQL > simple filter > required ", () => {
  beforeEach(() => {
    H.restore();
    cy.signInAsAdmin();

    H.createNativeQuestionAndDashboard({
      questionDetails,
      dashboardDetails,
    }).then(({ body: dashboardCard }) => {
      const { card_id, dashboard_id } = dashboardCard;

      const mapFilterToCard = {
        parameter_mappings: [
          {
            parameter_id: filter.id,
            card_id,
            target: ["variable", ["template-tag", "filter"]],
          },
        ],
      };

      H.editDashboardCard(dashboardCard, mapFilterToCard);

      H.visitDashboard(dashboard_id);
    });
  });

  it("should respect default filter precedence while properly updating the url for each step of the flow", () => {
    // Default dashboard filter
    cy.location("search").should("eq", "?text=Bar");

    cy.findByTestId("dashcard").contains("Bar");

    cy.findByDisplayValue("Bar");

    H.clearFilterWidget();

    cy.location("search").should("eq", "?text=");

    // SQL question defaults
    cy.findByTestId("dashcard").contains("Foo");

    // The empty filter widget
    cy.findByPlaceholderText("Text");

    cy.reload();

    // This part confirms that the issue metabase#13960 has been fixed
    cy.location("search").should("eq", "?text=");

    cy.findByTestId("dashcard").contains("Foo");

    // Let's make sure the default dashboard filter is respected upon a subsequent visit from the root
    cy.visit("/collection/root");
    // eslint-disable-next-line no-unscoped-text-selectors -- deprecated usage
    cy.findByText("Required Filters Dashboard").click();

    cy.location("search").should("eq", "?text=Bar");

    // Finally, when we remove dashboard filter's default value, the url should reflect that by removing the placeholder
    H.editDashboard();

    H.filterWidget({ isEditing: true, name: "Text" }).click();

    H.sidebar().within(() => {
      removeDefaultFilterValue("Bar");
    });

    H.saveDashboard();

    // The URL query params should include the value from the dashboard filter default
    cy.location("search").should("eq", "?text=");
  });
});

function removeDefaultFilterValue(value) {
  cy.findByDisplayValue(value).parent().find(".Icon-close").click();
}
