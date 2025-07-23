import { Provider } from "react-redux";
import { render } from "@testing-library/react";
import { store as defaultStore } from "../../store";
import type { Store } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    }
  }
});

export const renderWithProviders = (
  ui: React.ReactElement,
  store: Store = defaultStore
) => {
  const queryClient = createTestQueryClient();
  return render(
    <Provider store={store}>
      <MemoryRouter><QueryClientProvider client={queryClient}>{ui}</QueryClientProvider></MemoryRouter>
    </Provider>
  );
};
