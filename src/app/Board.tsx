import { COLUMNS } from "../domain/columns";

export function Board() {
  return (
    <section className="hr-board" aria-label="Board">
      {COLUMNS.map((col) => (
        <section key={col.status} className="hr-column" data-testid="column" aria-labelledby={`col-${col.status}`}>
          <h2 id={`col-${col.status}`} className="hr-column__title">
            {col.title}
          </h2>
          <p className="hr-column__empty">No items yet</p>
        </section>
      ))}
    </section>
  );
}
