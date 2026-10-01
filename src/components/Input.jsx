// Render a labeled input with standard styling.
export default function Input({ label, id, ...props }) {
  return <label htmlFor={id}>{label}<input id={id} {...props} /></label>;
}
