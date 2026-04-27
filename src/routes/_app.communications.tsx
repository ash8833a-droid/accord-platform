import { createFileRoute } from "@tanstack/react-router";
import { CommunicationsBoard } from "@/components/communications/CommunicationsBoard";

export const Route = createFileRoute("/_app/communications")({
  component: CommunicationsPage,
});

function CommunicationsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <CommunicationsBoard />
    </div>
  );
}
