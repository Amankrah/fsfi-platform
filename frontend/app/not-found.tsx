import Link from "next/link";
import { Container } from "@/components/shell/page";

export default function NotFound() {
  return (
    <Container className="py-16">
      <p className="t-ui text-ink-subtle">Error 404</p>
      <h1 className="mt-2 t-h1">Page not found</h1>
      <p className="mt-3 max-w-[68ch] t-lead text-ink-muted">
        The address may be mistyped, or the page may have moved. The list below covers every section of the platform.
      </p>
      <ul className="mt-6 space-y-2">
        {[
          ["/", "Home"],
          ["/method", "Method"],
          ["/assessments", "Assessments"],
          ["/data", "Data and downloads"],
        ].map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="link">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
