import { Suspense } from "react";
import { Workspace } from "@/components/workspace/workspace";

export default function NotebookPage({ params }: PageProps<"/app/notebook/[id]">) {
  return (
    // With Cache Components, route params are request-time data and are read
    // inside a Suspense boundary.
    <Suspense fallback={null}>
      <NotebookFromParams params={params} />
    </Suspense>
  );
}

async function NotebookFromParams({ params }: Pick<PageProps<"/app/notebook/[id]">, "params">) {
  const { id } = await params;
  return <Workspace notebookId={id} />;
}
