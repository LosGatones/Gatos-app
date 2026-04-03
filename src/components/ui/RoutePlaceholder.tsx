import { ReactNode } from "react";

type RoutePlaceholderProps = {
  title: string;
  description?: string;
  extra?: ReactNode;
};

export function RoutePlaceholder({ title, description, extra }: RoutePlaceholderProps) {
  return (
    <section className="panel stack">
      <div>
        <div className="status">Phase 1</div>
      </div>
      <div>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {extra}
    </section>
  );
}
