export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      {actions ? <div className="actions">{actions}</div> : null}
      <h1>{title}</h1>
      {desc ? <p className="desc">{desc}</p> : null}
    </header>
  );
}
