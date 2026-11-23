import { Suspense } from "react";
import { CountryShell } from "@/components/shell/country-shell";
import { Container } from "@/components/shell/page";
import { PageSkeleton } from "@/components/states";

export default async function CountryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <Container wide className="pt-12">
          <PageSkeleton />
        </Container>
      }
    >
      <CountryShell id={id}>{children}</CountryShell>
    </Suspense>
  );
}
