import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/finance")({
  beforeLoad: () => {
    throw redirect({ to: "/committee/$type", params: { type: "finance" } });
  },
  component: () => null,
});
