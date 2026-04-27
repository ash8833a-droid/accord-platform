import { createFileRoute } from "@tanstack/react-router";
import { PostsBoard } from "@/components/posts/PostsBoard";

export const Route = createFileRoute("/_app/posts")({
  component: PostsPage,
});

function PostsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <PostsBoard />
    </div>
  );
}
