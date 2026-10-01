// Render a reusable button with standard styling.
export default function Button({ children, ...props }) {
  return <button type="button" {...props}>{children}</button>;
}
