import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <DashboardShell jobId={jobId} />;
}
