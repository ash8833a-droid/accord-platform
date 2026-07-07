import { createFileRoute } from "@tanstack/react-router";
import { AlbumAdminPanel } from "@/components/album/AlbumAdminPanel";

export const Route = createFileRoute("/_app/admin/album")({
  component: AlbumAdminPanel,
});