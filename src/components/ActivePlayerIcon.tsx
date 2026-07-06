/** Side-profile elbow and hand — indicates whose turn it is to throw. */
export function ActivePlayerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 19.5 5.5 14.5 10.5 11.5 15.5 9" />
      <path d="M15.5 9 19 7.5" />
      <path d="M19 7.5 20.5 9.2" />
    </svg>
  );
}
