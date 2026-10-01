// Display a consistent heading and short explanation for a page.
export default function PageHeading({ title, description }) {
  return <div className="page-heading"><h2>{title}</h2><p>{description}</p></div>;
}
