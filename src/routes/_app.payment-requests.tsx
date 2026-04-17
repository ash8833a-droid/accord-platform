import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/payment-requests")({
  beforeLoad: () => {
    throw redirect({ to: "/committee/$type", params: { type: "finance" } });
  },
  component: () => null,
});
