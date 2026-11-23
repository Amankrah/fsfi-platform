import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Reading width (1120 px, text in a two-thirds measure). */
export function Container({ className, wide, ...props }: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn("mx-auto w-full px-4 md:px-6", wide ? "max-w-[1440px]" : "max-w-[1120px]", className)}
      {...props}
    />
  );
}

/** Page header for public reading pages: optional 3:1 treated photograph, breadcrumb, h1, lead. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  image,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  image?: { src: string; alt: string; credit: string };
  className?: string;
}) {
  return (
    <header className={cn("border-b border-rule", className)}>
      {image ? <HeaderImage {...image} /> : null}
      <Container className="pb-8 pt-8 md:pb-10 md:pt-10">
        {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[68ch]">
            <h1 className="t-h1 text-balance">{title}</h1>
            {description ? <p className="mt-3 t-lead text-ink-muted text-pretty">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </Container>
    </header>
  );
}

/** 3:1 duotone header image with a quiet credit line. */
export function HeaderImage({ src, alt, credit }: { src: string; alt: string; credit: string }) {
  return (
    <figure className="relative">
      <div className="relative aspect-[3/1] max-h-[360px] w-full overflow-hidden bg-evergreen">
        <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
      </div>
      <figcaption className="mx-auto w-full max-w-[1120px] px-4 pt-1.5 text-right t-caption text-ink-subtle md:px-6">
        {credit}
      </figcaption>
    </figure>
  );
}

/** Section of a reading page: serif h2, optional lead, alternating paper/ivory bands. */
export function Section({
  id,
  title,
  lead,
  band = "paper",
  children,
  className,
  major,
}: {
  id?: string;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  band?: "paper" | "ivory";
  children?: React.ReactNode;
  className?: string;
  major?: boolean;
}) {
  return (
    <section
      id={id}
      data-major={major ? "" : undefined}
      aria-labelledby={id && title ? `${id}-h` : undefined}
      className={cn(band === "ivory" ? "bg-ivory" : "bg-paper", "border-b border-rule py-12 md:py-16", className)}
    >
      <Container>
        {title ? (
          <h2 id={id ? `${id}-h` : undefined} className="t-h2 max-w-[68ch]">
            {title}
          </h2>
        ) : null}
        {lead ? <p className="mt-3 max-w-[68ch] t-lead text-ink-muted">{lead}</p> : null}
        {children ? <div className={title || lead ? "mt-6" : undefined}>{children}</div> : null}
      </Container>
    </section>
  );
}

/** Heading inside a workspace page. */
export function SectionTitle({
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 max-w-[68ch]", className)}>
      <h2 className="t-h2">{title}</h2>
      {children ? <p className="mt-1 t-ui text-ink-muted text-pretty">{children}</p> : null}
    </div>
  );
}
