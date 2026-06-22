import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Provider } from "@/components/ui/provider";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the app heading", () => {
    render(
      <Provider>
        <HomePage />
      </Provider>,
    );
    expect(screen.getByRole("heading", { name: "Minha Inflação" })).toBeInTheDocument();
  });
});
