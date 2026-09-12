export function SearchForm({
  action,
  defaultValue,
  hidden,
  label,
}: {
  action: string;
  defaultValue?: string;
  hidden?: Readonly<Record<string, string>>;
  label?: string;
}) {
  return (
    <form className="searchbox" action={action} method="get">
      <label htmlFor="q" hidden>
        Your idea
      </label>
      <input
        id="q"
        name="q"
        type="text"
        defaultValue={defaultValue ?? ""}
        placeholder="Describe the idea — e.g. a cancer awareness campaign for my campus"
        autoComplete="off"
      />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button className="primary" type="submit">
        {label ?? "Refine"}
      </button>
    </form>
  );
}
