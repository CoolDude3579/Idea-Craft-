/** One flat line-icon per angle, in the accent, matching the reference cards. */
export function AngleIcon({ categoryId }: { categoryId: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (categoryId === "super") {
    // Stacked layers: several ideas filed as one.
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 3.5 20 8l-8 4.5L4 8l8-4.5Z" />
        <path d="M4 12.5 12 17l8-4.5" />
        <path d="M4 16.5 12 21l8-4.5" />
      </svg>
    );
  }
  if (categoryId === "research") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5A1.5 1.5 0 0 0 20 18.5v-13Z" />
      </svg>
    );
  }
  if (categoryId === "art") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M15 4.5 19.5 9 9 19.5H4.5V15L15 4.5Z" />
        <path d="M12.5 7 17 11.5" />
      </svg>
    );
  }
  if (categoryId === "writing") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M20 9.5 12.5 17 8 18l1-4.5L16.5 6 20 9.5Z" />
        <path d="M4 20h9" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M6 3h9l3.5 3.5V21H6V3Z" />
      <path d="M14.5 3v4H19" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export default AngleIcon;
